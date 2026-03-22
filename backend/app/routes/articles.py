from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Article, Person, SpeakerType, Party, Chamber, Quote
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

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.post("/extract", response_model=ExtractResponse)
def extract_from_url(req: ExtractRequest):
    try:
        article_data = fetch_article(req.url)
    except FetchError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        raw_quotes = extract_quotes(article_data["text"])
    except ExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))

    quotes = [
        ExtractedQuote(
            speaker_name=q.get("speaker_name", "Unknown"),
            speaker_title=q.get("speaker_title"),
            speaker_type=q.get("speaker_type"),
            quote_text=q.get("quote_text", ""),
            context=q.get("context"),
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

        quote = Quote(
            person_id=person_id,
            article_id=article.id,
            quote_text=q.quote_text,
            context=q.context,
            date_said=q.date_said,
        )
        db.add(quote)
        saved_count += 1

    db.commit()
    return SaveResponse(article_id=article.id, quote_count=saved_count)
