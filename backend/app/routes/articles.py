from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Article, Person, SpeakerType, Party, Chamber, Quote, Jurisdiction
from ..schemas import (
    ExtractRequest,
    ExtractResponse,
    ExtractedQuote,
    ArticleMetadata,
    SaveRequest,
    SaveResponse,
)
from ..services.fetcher import fetch_article, FetchError
from ..services.extractor import extract_quotes, ExtractionError
from ..services.dedup import find_duplicate, check_duplicates_batch
from ..services.jurisdiction_quote import set_quote_jurisdictions


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


def _as_jurisdiction_list(val) -> list:
    if val is None:
        return []
    if isinstance(val, list):
        return [str(x).strip() for x in val if x is not None and str(x).strip()]
    return []

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.post("/extract", response_model=ExtractResponse)
def extract_from_url(req: ExtractRequest, db: Session = Depends(get_db)):
    try:
        article_data = fetch_article(req.url)
    except FetchError as e:
        raise HTTPException(status_code=422, detail=str(e))

    block = _jurisdiction_prompt_block(db)
    try:
        raw_quotes = extract_quotes(article_data["text"], block)
    except ExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))

    quotes = [
        ExtractedQuote(
            speaker_name=q.get("speaker_name", "Unknown"),
            speaker_title=q.get("speaker_title"),
            speaker_type=q.get("speaker_type"),
            quote_text=q.get("quote_text", ""),
            context=q.get("context"),
            jurisdictions=_as_jurisdiction_list(q.get("jurisdictions")),
        )
        for q in raw_quotes
    ]

    article_meta = ArticleMetadata(
        title=article_data["title"],
        publication=article_data["publication"],
        published_date=article_data["published_date"],
        url=article_data["url"],
    )

    return ExtractResponse(article=article_meta, quotes=quotes)


@router.post("/save", response_model=SaveResponse)
def save_article(req: SaveRequest, db: Session = Depends(get_db)):
    existing = db.query(Article).filter(Article.url == req.article.url).first()
    if existing:
        article = existing
    else:
        article = Article(
            url=req.article.url,
            title=req.article.title,
            publication=req.article.publication,
            published_date=req.article.published_date,
        )
        db.add(article)
        db.flush()

    saved_count = 0
    duplicate_count = 0
    created_people: dict[str, int] = {}
    for q in req.quotes:
        if q.person_id:
            person_id = q.person_id
        elif q.new_person:
            name_key = q.new_person.name.strip().lower()
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
                        name=q.new_person.name,
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
            context=q.context,
            date_said=q.date_said,
            date_recorded=q.date_recorded or date.today(),
            is_duplicate=q.mark_as_duplicate,
            duplicate_of_id=dup_of_id,
        )
        db.add(quote)
        db.flush()
        set_quote_jurisdictions(db, quote, q.jurisdiction_names)
        saved_count += 1
        if q.mark_as_duplicate:
            duplicate_count += 1

    db.commit()
    return SaveResponse(
        article_id=article.id,
        quote_count=saved_count,
        duplicate_count=duplicate_count,
    )
