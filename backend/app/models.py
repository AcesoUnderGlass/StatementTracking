import enum
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, JSON, String,
    Table, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .database import Base


class SpeakerType(str, enum.Enum):
    elected = "elected"
    staff = "staff"
    think_tank = "think_tank"
    gov_inst = "gov_inst"
    commercial = "commercial"


_VALID_SPEAKER_TYPES = {t.value for t in SpeakerType}
_DEFAULT_SPEAKER_TYPE = SpeakerType.elected


def safe_speaker_type(raw: Optional[str]) -> SpeakerType:
    """Convert a raw string to SpeakerType, falling back to *elected*
    when the value is missing or not in the enum (e.g. novel LLM output)."""
    if raw and raw in _VALID_SPEAKER_TYPES:
        return SpeakerType(raw)
    return _DEFAULT_SPEAKER_TYPE


class Party(str, enum.Enum):
    democrat = "Democrat"
    republican = "Republican"
    independent = "Independent"
    other = "Other"


class Chamber(str, enum.Enum):
    senate = "Senate"
    house = "House"
    executive = "Executive"
    other = "Other"


class ReviewStatus(str, enum.Enum):
    approved = "approved"
    pending = "pending"
    rejected = "rejected"


quote_jurisdictions = Table(
    "quote_jurisdictions",
    Base.metadata,
    Column("quote_id", Integer, ForeignKey("quotes.id", ondelete="CASCADE"), primary_key=True),
    Column("jurisdiction_id", Integer, ForeignKey("jurisdictions.id", ondelete="CASCADE"), primary_key=True),
)

quote_topics = Table(
    "quote_topics",
    Base.metadata,
    Column("quote_id", Integer, ForeignKey("quotes.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", Integer, ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
)


class Jurisdiction(Base):
    __tablename__ = "jurisdictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    abbreviation: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[SpeakerType] = mapped_column(Enum(SpeakerType), nullable=False)
    party: Mapped[Optional[Party]] = mapped_column(Enum(Party), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    chamber: Mapped[Optional[Chamber]] = mapped_column(Enum(Chamber), nullable=True)
    locales: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    employer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    quotes: Mapped[List["Quote"]] = relationship(back_populates="person")


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    publication: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    published_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    ingestion_source: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    ingestion_source_detail: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True
    )

    quotes: Mapped[List["Quote"]] = relationship(back_populates="article")


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), nullable=False)
    article_id: Mapped[int] = mapped_column(
        ForeignKey("articles.id"), nullable=False
    )
    quote_text: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date_said: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    date_recorded: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_duplicate: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0"
    )
    duplicate_of_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("quotes.id"), nullable=True
    )
    original_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    review_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="approved"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    person: Mapped["Person"] = relationship(back_populates="quotes")
    article: Mapped["Article"] = relationship(back_populates="quotes")
    duplicate_of: Mapped[Optional["Quote"]] = relationship(
        remote_side=[id], foreign_keys=[duplicate_of_id]
    )
    jurisdictions: Mapped[List["Jurisdiction"]] = relationship(
        secondary=quote_jurisdictions, lazy="selectin",
    )
    topics: Mapped[List["Topic"]] = relationship(
        secondary=quote_topics, lazy="selectin",
    )
