import enum
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .database import Base


class SpeakerType(str, enum.Enum):
    elected = "elected"
    staff = "staff"
    think_tank = "think_tank"
    gov_inst = "gov_inst"


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


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[SpeakerType] = mapped_column(Enum(SpeakerType), nullable=False)
    party: Mapped[Optional[Party]] = mapped_column(Enum(Party), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    chamber: Mapped[Optional[Chamber]] = mapped_column(Enum(Chamber), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    person: Mapped["Person"] = relationship(back_populates="quotes")
    article: Mapped["Article"] = relationship(back_populates="quotes")
