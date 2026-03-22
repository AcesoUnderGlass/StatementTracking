from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ── People ──────────────────────────────────────────────────────────────

class PersonBase(BaseModel):
    name: str
    type: str
    party: Optional[str] = None
    role: Optional[str] = None
    chamber: Optional[str] = None
    state: Optional[str] = None
    employer: Optional[str] = None
    notes: Optional[str] = None


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    party: Optional[str] = None
    role: Optional[str] = None
    chamber: Optional[str] = None
    state: Optional[str] = None
    employer: Optional[str] = None
    notes: Optional[str] = None


class PersonOut(PersonBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    quote_count: int = 0


# ── Articles ────────────────────────────────────────────────────────────

class ArticleMetadata(BaseModel):
    title: Optional[str] = None
    publication: Optional[str] = None
    published_date: Optional[date] = None
    url: str


class ArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    url: str
    title: Optional[str] = None
    publication: Optional[str] = None
    published_date: Optional[date] = None
    fetched_at: datetime


# ── Quotes ──────────────────────────────────────────────────────────────

class ExtractedQuote(BaseModel):
    speaker_name: str
    speaker_title: Optional[str] = None
    speaker_type: Optional[str] = None
    quote_text: str
    context: Optional[str] = None


class ExtractRequest(BaseModel):
    url: str


class ExtractResponse(BaseModel):
    article: ArticleMetadata
    quotes: List[ExtractedQuote]


class QuoteSaveItem(BaseModel):
    quote_text: str
    context: Optional[str] = None
    date_said: Optional[date] = None
    person_id: Optional[int] = None
    new_person: Optional[PersonCreate] = None


class SaveRequest(BaseModel):
    article: ArticleMetadata
    quotes: List[QuoteSaveItem]


class SaveResponse(BaseModel):
    article_id: int
    quote_count: int


class QuoteUpdate(BaseModel):
    quote_text: Optional[str] = None
    context: Optional[str] = None
    date_said: Optional[date] = None
    person_id: Optional[int] = None


class QuoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    quote_text: str
    context: Optional[str] = None
    date_said: Optional[date] = None
    created_at: datetime
    person: Optional[PersonBase] = None
    article: Optional[ArticleMetadata] = None


class QuoteListResponse(BaseModel):
    quotes: List[QuoteOut]
    total: int
    page: int
    page_size: int


# ── Stats ───────────────────────────────────────────────────────────────

class PartyCount(BaseModel):
    party: Optional[str]
    count: int


class MonthCount(BaseModel):
    month: str
    count: int


class TopSpeaker(BaseModel):
    person_id: int
    name: str
    party: Optional[str]
    role: Optional[str]
    count: int


class StatsResponse(BaseModel):
    total_quotes: int
    total_people: int
    quotes_by_party: List[PartyCount]
    quotes_over_time: List[MonthCount]
    top_speakers: List[TopSpeaker]
