from __future__ import annotations

import difflib
import logging
from calendar import timegm
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Article, Person, SpeakerType, Party, Chamber, Quote, Jurisdiction, Topic
import feedparser

from ..schemas import (
    ExtractRequest,
    ExtractResponse,
    ExtractedQuote,
    ArticleMetadata,
    SaveRequest,
    SaveResponse,
    BulkEntryRequest,
    BulkEntryResult,
    BulkUnmatchedQuote,
    CheckUrlsRequest,
    CheckUrlsResponse,
    AutoIngestRequest,
    AutoIngestResult,
    HarvestFeedRequest,
    HarvestCandidate,
    HarvestFeedResponse,
    AddQuoteRequest,
)
from ..services.fetcher import fetch_article, FetchError
from ..services.extractor import extract_quotes, ExtractionError
from ..services.dedup import find_duplicate, check_duplicates_batch
from ..services.jurisdiction_quote import set_quote_jurisdictions
from ..services.speaker_aliases import canonical_speaker_name
from ..services.topic_quote import set_quote_topics

logger = logging.getLogger(__name__)


def _jurisdiction_prompt_block(db: Session) -> str:
    rows = db.query(Jurisdiction).order_by(Jurisdiction.name).all()
    if not rows:
        return "(No jurisdictions seeded — run migrations.)"
    lines = []
    for r in rows:
        if r.abbreviation:
            lines.append(f"- {r.name} (abbreviation: {r.abbreviation})")
        else:
            lines.append(f"- {r.name}")
    return "\n".join(lines)


def _topic_prompt_block(db: Session) -> str:
    rows = db.query(Topic).order_by(Topic.name).all()
    if not rows:
        return "(No topics seeded — run migrations.)"
    return "\n".join(f"- {r.name}" for r in rows)


def _as_jurisdiction_list(val) -> list:
    if val is None:
        return []
    if isinstance(val, list):
        return [str(x).strip() for x in val if x is not None and str(x).strip()]
    return []

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _raw_to_extracted(q: dict) -> ExtractedQuote:
    """Convert a single raw LLM quote dict to an ``ExtractedQuote``."""
    return ExtractedQuote(
        speaker_name=q.get("speaker_name", "Unknown"),
        speaker_title=q.get("speaker_title"),
        speaker_type=q.get("speaker_type"),
        quote_text=q.get("quote_text", ""),
        original_text=q.get("original_quote_text"),
        context=q.get("context"),
        jurisdictions=_as_jurisdiction_list(q.get("jurisdictions")),
        topics=_as_jurisdiction_list(q.get("topics")),
    )


@router.post("/extract", response_model=ExtractResponse)
def extract_from_url(req: ExtractRequest, db: Session = Depends(get_db)):
    try:
        article_data = fetch_article(req.url)
    except FetchError as e:
        raise HTTPException(status_code=422, detail=str(e))

    source_type = article_data.get("source_type", "article")
    language = article_data.get("language", "en")
    block = _jurisdiction_prompt_block(db)
    topic_block = _topic_prompt_block(db)
    try:
        raw_quotes = extract_quotes(
            article_data["text"],
            block,
            topic_block,
            source_type=source_type,
            language=language,
        )
    except ExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))

    quotes = [_raw_to_extracted(q) for q in raw_quotes]

    article_meta = ArticleMetadata(
        title=article_data["title"],
        publication=article_data["publication"],
        published_date=article_data["published_date"],
        url=article_data["url"],
    )

    return ExtractResponse(article=article_meta, quotes=quotes, source_type=source_type)


@router.post("/save", response_model=SaveResponse)
def save_article(req: SaveRequest, db: Session = Depends(get_db)):
    is_automated = req.ingestion_source and req.ingestion_source != "manual"
    existing = db.query(Article).filter(Article.url == req.article.url).first()
    if existing:
        article = existing
    else:
        article = Article(
            url=req.article.url,
            title=req.article.title,
            publication=req.article.publication,
            published_date=req.article.published_date,
            ingestion_source=req.ingestion_source,
            ingestion_source_detail=req.ingestion_source_detail,
        )
        db.add(article)
        db.flush()

    review_status = "pending" if is_automated else "approved"
    saved_count = 0
    duplicate_count = 0
    created_people: dict[str, int] = {}
    for q in req.quotes:
        if q.person_id:
            person_id = q.person_id
        elif q.new_person:
            display_name = canonical_speaker_name(q.new_person.name)
            name_key = display_name.lower()
            if name_key in created_people:
                person_id = created_people[name_key]
            else:
                existing_person = db.query(Person).filter(
                    Person.name.ilike(name_key)
                ).first()
                if existing_person:
                    person_id = existing_person.id
                else:
                    person = Person(
                        name=display_name,
                        type=SpeakerType(q.new_person.type),
                        party=Party(q.new_person.party) if q.new_person.party else None,
                        role=q.new_person.role,
                        chamber=Chamber(q.new_person.chamber) if q.new_person.chamber else None,
                        state=q.new_person.state,
                        employer=q.new_person.employer,
                        notes=q.new_person.notes,
                    )
                    db.add(person)
                    db.flush()
                    person_id = person.id
                created_people[name_key] = person_id
        else:
            raise HTTPException(
                status_code=400,
                detail="Each quote must have either person_id or new_person.",
            )

        dup_of_id = None
        if q.mark_as_duplicate:
            dup = find_duplicate(db, person_id, q.quote_text)
            dup_of_id = dup.id if dup else None

        quote = Quote(
            person_id=person_id,
            article_id=article.id,
            quote_text=q.quote_text,
            original_text=q.original_text,
            context=q.context,
            date_said=q.date_said,
            date_recorded=q.date_recorded or date.today(),
            is_duplicate=q.mark_as_duplicate,
            duplicate_of_id=dup_of_id,
            review_status=review_status,
        )
        db.add(quote)
        db.flush()
        set_quote_jurisdictions(db, quote, q.jurisdiction_names)
        set_quote_topics(db, quote, q.topic_names)
        saved_count += 1
        if q.mark_as_duplicate:
            duplicate_count += 1

    db.commit()
    return SaveResponse(
        article_id=article.id,
        quote_count=saved_count,
        duplicate_count=duplicate_count,
    )


@router.post("/check-urls", response_model=CheckUrlsResponse)
def check_existing_urls(req: CheckUrlsRequest, db: Session = Depends(get_db)):
    """Return the subset of submitted URLs that already have an Article row."""
    if not req.urls:
        return CheckUrlsResponse(existing_urls=[])
    existing = (
        db.query(Article.url)
        .filter(Article.url.in_(req.urls))
        .all()
    )
    return CheckUrlsResponse(existing_urls=[row[0] for row in existing])


# ── Bulk processing ─────────────────────────────────────────────────────

_FUZZY_THRESHOLD = 0.80
_VALID_SPEAKER_TYPES = {t.value for t in SpeakerType}


def _resolve_person(db: Session, name: str, speaker_type: str | None, cache: dict[str, int]) -> int:
    """Look up a Person by name or create one. Uses *cache* to avoid
    redundant DB hits within a single request."""
    name = canonical_speaker_name(name)
    name_key = name.strip().lower()
    if name_key in cache:
        return cache[name_key]

    existing = db.query(Person).filter(Person.name.ilike(name_key)).first()
    if existing:
        cache[name_key] = existing.id
        return existing.id

    st = speaker_type if speaker_type in _VALID_SPEAKER_TYPES else "elected"
    person = Person(name=name, type=SpeakerType(st))
    db.add(person)
    db.flush()
    cache[name_key] = person.id
    return person.id


def _save_bulk_quotes(
    db: Session,
    article_data: dict,
    raw_quotes: list[dict],
    extracted: list[ExtractedQuote],
    ingestion_source: str | None = None,
    ingestion_source_detail: str | None = None,
) -> int:
    """Persist article + quotes and return the number of saved quotes."""
    existing_article = db.query(Article).filter(Article.url == article_data["url"]).first()
    if existing_article:
        article = existing_article
    else:
        article = Article(
            url=article_data["url"],
            title=article_data["title"],
            publication=article_data["publication"],
            published_date=article_data["published_date"],
            ingestion_source=ingestion_source,
            ingestion_source_detail=ingestion_source_detail,
        )
        db.add(article)
        db.flush()

    is_automated = ingestion_source and ingestion_source != "manual"
    review_status = "pending" if is_automated else "approved"

    person_cache: dict[str, int] = {}
    saved = 0
    for eq in extracted:
        person_id = _resolve_person(db, eq.speaker_name, eq.speaker_type, person_cache)
        quote = Quote(
            person_id=person_id,
            article_id=article.id,
            quote_text=eq.quote_text,
            original_text=eq.original_text,
            context=eq.context,
            date_recorded=date.today(),
            review_status=review_status,
        )
        db.add(quote)
        db.flush()
        set_quote_jurisdictions(db, quote, eq.jurisdictions or None)
        set_quote_topics(db, quote, eq.topics or None)
        saved += 1

    db.commit()
    return saved


def _fuzzy_match(expected: str, candidates: list[str], threshold: float = _FUZZY_THRESHOLD) -> bool:
    """Return True if *expected* is substantially present in any candidate."""
    exp_lower = expected.lower()
    for cand in candidates:
        ratio = difflib.SequenceMatcher(None, exp_lower, cand.lower()).ratio()
        if ratio >= threshold:
            return True
    return False


@router.post("/bulk-process-entry", response_model=BulkEntryResult)
def bulk_process_entry(req: BulkEntryRequest, db: Session = Depends(get_db)):
    # 1. Fetch
    try:
        article_data = fetch_article(req.url)
    except FetchError as e:
        logger.warning("Bulk fetch error for %s: %s", req.url, e)
        unmatched = [
            BulkUnmatchedQuote(expected_quote=q, reason="fetch_error")
            for q in req.expected_quotes
        ] if req.expected_quotes else [
            BulkUnmatchedQuote(expected_quote="", reason="fetch_error")
        ]
        return BulkEntryResult(status="error", unmatched_quotes=unmatched, error=str(e))

    # 2. Extract
    block = _jurisdiction_prompt_block(db)
    topic_block = _topic_prompt_block(db)
    language = article_data.get("language", "en")
    try:
        raw_quotes = extract_quotes(
            article_data["text"],
            block,
            topic_block,
            source_type=article_data.get("source_type", "article"),
            language=language,
        )
    except ExtractionError as e:
        logger.warning("Bulk extraction error for %s: %s", req.url, e)
        unmatched = [
            BulkUnmatchedQuote(expected_quote=q, reason="extraction_error")
            for q in req.expected_quotes
        ] if req.expected_quotes else [
            BulkUnmatchedQuote(expected_quote="", reason="extraction_error")
        ]
        return BulkEntryResult(status="error", unmatched_quotes=unmatched, error=str(e))

    extracted = [_raw_to_extracted(q) for q in raw_quotes]
    extracted_texts = [eq.quote_text for eq in extracted]

    article_meta = ArticleMetadata(
        title=article_data["title"],
        publication=article_data["publication"],
        published_date=article_data["published_date"],
        url=article_data["url"],
    )

    # 3. No expected quotes → pending (skip auto-approval)
    if not req.expected_quotes:
        return BulkEntryResult(
            status="pending",
            extracted_count=len(extracted),
            article=article_meta,
            extracted_quotes=extracted,
        )

    # 4. Fuzzy-match each expected quote
    unmatched: list[BulkUnmatchedQuote] = []
    for exp_q in req.expected_quotes:
        if not _fuzzy_match(exp_q, extracted_texts):
            unmatched.append(BulkUnmatchedQuote(expected_quote=exp_q, reason="quote_not_found"))

    if unmatched:
        return BulkEntryResult(
            status="pending",
            extracted_count=len(extracted),
            unmatched_quotes=unmatched,
            article=article_meta,
            extracted_quotes=extracted,
        )

    # 5. All matched → save
    saved = _save_bulk_quotes(db, article_data, raw_quotes, extracted)
    return BulkEntryResult(status="approved", saved_count=saved, extracted_count=len(extracted))


# ── Auto-ingest (for automated monitors) ─────────────────────────────

@router.post("/auto-ingest", response_model=AutoIngestResult)
def auto_ingest(req: AutoIngestRequest, db: Session = Depends(get_db)):
    """Simplified endpoint for automated monitors. Accepts a URL, runs the
    full fetch→extract→save pipeline, and marks all quotes as pending."""

    existing_article = db.query(Article).filter(Article.url == req.url).first()
    if existing_article:
        return AutoIngestResult(
            status="skipped",
            error="Article URL already exists in the database.",
        )

    try:
        article_data = fetch_article(req.url)
    except FetchError as e:
        logger.warning("Auto-ingest fetch error for %s: %s", req.url, e)
        return AutoIngestResult(status="error", error=str(e))

    block = _jurisdiction_prompt_block(db)
    topic_block = _topic_prompt_block(db)
    language = article_data.get("language", "en")
    try:
        raw_quotes = extract_quotes(
            article_data["text"],
            block,
            topic_block,
            source_type=article_data.get("source_type", "article"),
            language=language,
        )
    except ExtractionError as e:
        logger.warning("Auto-ingest extraction error for %s: %s", req.url, e)
        return AutoIngestResult(status="error", error=str(e))

    if not raw_quotes:
        return AutoIngestResult(
            status="skipped",
            error="No AI-related quotes found in the article.",
        )

    extracted = [_raw_to_extracted(q) for q in raw_quotes]

    saved = _save_bulk_quotes(
        db,
        article_data,
        raw_quotes,
        extracted,
        ingestion_source=req.ingestion_source,
        ingestion_source_detail=req.ingestion_source_detail,
    )

    article_meta = ArticleMetadata(
        title=article_data["title"],
        publication=article_data["publication"],
        published_date=article_data["published_date"],
        url=article_data["url"],
        ingestion_source=req.ingestion_source,
        ingestion_source_detail=req.ingestion_source_detail,
    )

    return AutoIngestResult(
        status="pending",
        saved_count=saved,
        extracted_count=len(extracted),
        article=article_meta,
    )


# ── Feed Harvest (scan RSS for date range) ───────────────────────────

def _entry_published_date(entry) -> date | None:
    """Extract a UTC date from a feedparser entry's timestamp fields."""
    for attr in ("published_parsed", "updated_parsed"):
        tp = getattr(entry, attr, None)
        if tp is not None:
            dt = datetime.fromtimestamp(timegm(tp), tz=timezone.utc)
            return dt.date()
    return None


@router.post("/harvest-feed", response_model=HarvestFeedResponse)
def harvest_feed(req: HarvestFeedRequest):
    """Parse an RSS feed and return entries whose publication date falls
    within [start_date, end_date].  Does NOT update any poll watermarks."""

    parsed = feedparser.parse(req.feed_url)

    if parsed.bozo and not parsed.entries:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse feed: {parsed.bozo_exception}",
        )

    feed_title = getattr(parsed.feed, "title", None)
    total_entries = len(parsed.entries)
    candidates: list[HarvestCandidate] = []

    for entry in parsed.entries:
        pub = _entry_published_date(entry)

        if pub is not None and (pub < req.start_date or pub > req.end_date):
            continue

        link = entry.get("link", "")
        if not link:
            continue

        title = entry.get("title", "")
        candidates.append(HarvestCandidate(url=link, title=title, published_date=pub))

    return HarvestFeedResponse(
        candidates=candidates,
        total_entries=total_entries,
        feed_title=feed_title,
    )


# ── Batch approve / reject ───────────────────────────────────────────

@router.post("/{article_id}/approve-all")
def approve_all_quotes(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")
    count = (
        db.query(Quote)
        .filter(Quote.article_id == article_id, Quote.review_status == "pending")
        .update({"review_status": "approved"})
    )
    db.commit()
    return {"ok": True, "approved_count": count}


@router.post("/{article_id}/reject-all")
def reject_all_quotes(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")
    count = (
        db.query(Quote)
        .filter(Quote.article_id == article_id, Quote.review_status == "pending")
        .update({"review_status": "rejected"})
    )
    db.commit()
    return {"ok": True, "rejected_count": count}


# ── Add quote to existing article ────────────────────────────────────

@router.post("/{article_id}/add-quote")
def add_quote_to_article(
    article_id: int,
    req: AddQuoteRequest,
    db: Session = Depends(get_db),
):
    """Add a single quote to an existing article."""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")

    if not req.person_id and not req.new_person:
        raise HTTPException(
            status_code=400,
            detail="Either person_id or new_person is required.",
        )

    if req.person_id:
        person_id = req.person_id
    else:
        display_name = canonical_speaker_name(req.new_person.name)
        name_key = display_name.lower()
        existing_person = db.query(Person).filter(
            Person.name.ilike(name_key)
        ).first()
        if existing_person:
            person_id = existing_person.id
        else:
            person = Person(
                name=display_name,
                type=SpeakerType(req.new_person.type),
                party=Party(req.new_person.party) if req.new_person.party else None,
                role=req.new_person.role,
                chamber=Chamber(req.new_person.chamber) if req.new_person.chamber else None,
                state=req.new_person.state,
                employer=req.new_person.employer,
                notes=req.new_person.notes,
            )
            db.add(person)
            db.flush()
            person_id = person.id

    quote = Quote(
        person_id=person_id,
        article_id=article.id,
        quote_text=req.quote_text,
        context=req.context,
        date_said=req.date_said,
        date_recorded=date.today(),
        review_status="approved",
    )
    db.add(quote)
    db.flush()
    set_quote_jurisdictions(db, quote, req.jurisdiction_names)
    set_quote_topics(db, quote, req.topic_names)
    db.commit()

    return {"ok": True, "quote_id": quote.id}
