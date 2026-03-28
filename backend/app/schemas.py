from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


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
    ingestion_source: Optional[str] = None
    ingestion_source_detail: Optional[str] = None


class ArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    url: str
    title: Optional[str] = None
    publication: Optional[str] = None
    published_date: Optional[date] = None
    fetched_at: datetime
    ingestion_source: Optional[str] = None
    ingestion_source_detail: Optional[str] = None


# ── Quotes ──────────────────────────────────────────────────────────────

class ExtractedQuote(BaseModel):
    speaker_name: str
    speaker_title: Optional[str] = None
    speaker_type: Optional[str] = None
    quote_text: str
    original_text: Optional[str] = None
    context: Optional[str] = None
    jurisdictions: List[str] = Field(default_factory=list)
    topics: List[str] = Field(default_factory=list)


class ExtractRequest(BaseModel):
    url: str


class ExtractResponse(BaseModel):
    article: ArticleMetadata
    quotes: List[ExtractedQuote]
    source_type: str = "article"


class QuoteSaveItem(BaseModel):
    quote_text: str
    original_text: Optional[str] = None
    context: Optional[str] = None
    date_said: Optional[date] = None
    date_recorded: Optional[date] = None
    person_id: Optional[int] = None
    new_person: Optional[PersonCreate] = None
    mark_as_duplicate: bool = False
    jurisdiction_names: Optional[List[str]] = None
    topic_names: Optional[List[str]] = None


class SaveRequest(BaseModel):
    article: ArticleMetadata
    quotes: List[QuoteSaveItem]
    ingestion_source: Optional[str] = None
    ingestion_source_detail: Optional[str] = None


class SaveResponse(BaseModel):
    article_id: int
    quote_count: int
    duplicate_count: int = 0


class QuoteUpdate(BaseModel):
    quote_text: Optional[str] = None
    original_text: Optional[str] = None
    context: Optional[str] = None
    date_said: Optional[date] = None
    date_recorded: Optional[date] = None
    person_id: Optional[int] = None
    jurisdiction_names: Optional[List[str]] = None
    topic_names: Optional[List[str]] = None


class DuplicateCheckItem(BaseModel):
    speaker_name: str
    quote_text: str


class DuplicateCheckRequest(BaseModel):
    items: List[DuplicateCheckItem]


class ExistingQuoteMatch(BaseModel):
    id: int
    quote_text: str
    article_title: Optional[str] = None
    article_url: Optional[str] = None


class DuplicateCheckResult(BaseModel):
    is_duplicate: bool
    existing_quote: Optional[ExistingQuoteMatch] = None


class DuplicateCheckResponse(BaseModel):
    results: List[DuplicateCheckResult]


class QuoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    quote_text: str
    original_text: Optional[str] = None
    context: Optional[str] = None
    date_said: Optional[date] = None
    date_recorded: Optional[date] = None
    is_duplicate: bool = False
    duplicate_of_id: Optional[int] = None
    review_status: str = "approved"
    created_at: datetime
    jurisdictions: List[str] = Field(default_factory=list)
    topics: List[str] = Field(default_factory=list)
    person: Optional[PersonBase] = None
    article: Optional[ArticleMetadata] = None


class QuoteListResponse(BaseModel):
    quotes: List[QuoteOut]
    total: int
    page: int
    page_size: int


# ── Bulk Submit ─────────────────────────────────────────────────────────

class BulkEntryRequest(BaseModel):
    url: str
    speaker: str
    source_description: str
    expected_quotes: List[str] = Field(default_factory=list)


class BulkUnmatchedQuote(BaseModel):
    expected_quote: str
    reason: str


class BulkEntryResult(BaseModel):
    status: str
    saved_count: int = 0
    extracted_count: int = 0
    unmatched_quotes: List[BulkUnmatchedQuote] = Field(default_factory=list)
    error: Optional[str] = None
    article: Optional[ArticleMetadata] = None
    extracted_quotes: List[ExtractedQuote] = Field(default_factory=list)


# ── URL existence check ─────────────────────────────────────────────────

class CheckUrlsRequest(BaseModel):
    urls: List[str]


class CheckUrlsResponse(BaseModel):
    existing_urls: List[str]


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


# ── Auto-ingest ──────────────────────────────────────────────────────

class AutoIngestRequest(BaseModel):
    url: str
    ingestion_source: str
    ingestion_source_detail: Optional[str] = None


class AutoIngestResult(BaseModel):
    status: str
    saved_count: int = 0
    extracted_count: int = 0
    error: Optional[str] = None
    article: Optional[ArticleMetadata] = None


# ── Review Queue ─────────────────────────────────────────────────────

class PendingQuoteOut(BaseModel):
    id: int
    quote_text: str
    original_text: Optional[str] = None
    context: Optional[str] = None
    date_said: Optional[date] = None
    date_recorded: Optional[date] = None
    review_status: str = "pending"
    created_at: datetime
    jurisdictions: List[str] = Field(default_factory=list)
    topics: List[str] = Field(default_factory=list)
    person: Optional[PersonBase] = None


class PendingArticleOut(BaseModel):
    id: int
    url: str
    title: Optional[str] = None
    publication: Optional[str] = None
    published_date: Optional[date] = None
    fetched_at: datetime
    ingestion_source: Optional[str] = None
    ingestion_source_detail: Optional[str] = None
    quotes: List[PendingQuoteOut] = Field(default_factory=list)


class ReviewQueueResponse(BaseModel):
    articles: List[PendingArticleOut]
    total: int
    page: int
    page_size: int


class ReviewStatsResponse(BaseModel):
    pending_count: int


# ── Suggest Tags ─────────────────────────────────────────────────────

class SuggestTagsRequest(BaseModel):
    quote_text: str
    context: Optional[str] = None
    speaker_name: Optional[str] = None
    article_title: Optional[str] = None
    article_url: Optional[str] = None


class SuggestTagsResponse(BaseModel):
    jurisdictions: List[str]
    topics: List[str]


# ── Add Quote to Article ─────────────────────────────────────────────

class AddQuoteRequest(BaseModel):
    quote_text: str
    context: Optional[str] = None
    date_said: Optional[date] = None
    person_id: Optional[int] = None
    new_person: Optional[PersonCreate] = None
    jurisdiction_names: Optional[List[str]] = None
    topic_names: Optional[List[str]] = None


# ── Feed Harvest ─────────────────────────────────────────────────────

class HarvestFeedRequest(BaseModel):
    feed_url: str
    start_date: date
    end_date: date


class HarvestCandidate(BaseModel):
    url: str
    title: str
    published_date: Optional[date] = None


class HarvestFeedResponse(BaseModel):
    candidates: List[HarvestCandidate]
    total_entries: int
    feed_title: Optional[str] = None
