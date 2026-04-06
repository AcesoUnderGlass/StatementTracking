"""Shared test fixtures for the AI Quote Tracker backend."""

import json
from datetime import date, datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from alembic import command
from alembic.config import Config

from app.database import Base, get_db
from app.main import app
from app.models import Article, Chamber, Party, Person, Quote, SpeakerType

from helpers import MOCK_EXTRACTION_RESPONSE, MOCK_ARTICLE_DATA

BACKEND_DIR = Path(__file__).resolve().parents[1]


# ── Database ────────────────────────────────────────────────────────────


@pytest.fixture
def db_session():
    """Fresh in-memory SQLite database with all Alembic migrations applied."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _register_now(dbapi_conn, _):
        dbapi_conn.create_function("now", 0, lambda: datetime.utcnow().isoformat())

    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    alembic_cfg.set_main_option(
        "script_location", str(BACKEND_DIR / "alembic")
    )

    with engine.begin() as connection:
        alembic_cfg.attributes["connection"] = connection
        command.upgrade(alembic_cfg, "head")

    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestSession()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


# ── HTTP Client ─────────────────────────────────────────────────────────


@pytest.fixture
async def client(db_session):
    """Async test client with the database dependency overridden."""

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ── Anthropic Mock ──────────────────────────────────────────────────────


@pytest.fixture
def mock_anthropic(monkeypatch):
    """Patch the Anthropic SDK to return a hardcoded valid extraction response."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")

    mock_response = MagicMock()
    mock_response.content = [MagicMock()]
    mock_response.content[0].text = json.dumps(MOCK_EXTRACTION_RESPONSE)

    with patch("app.services.extractor.anthropic.Anthropic") as mock_cls:
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        mock_cls.return_value = mock_client
        yield mock_client


# ── Fetch Mock ───────────────────────────────────────────────────────────


@pytest.fixture
def mock_fetch(monkeypatch):
    """Patch fetch_article in the articles route module to return canned data."""
    with patch("app.routes.articles.fetch_article", return_value=dict(MOCK_ARTICLE_DATA)) as m:
        yield m


# ── Data Fixtures ───────────────────────────────────────────────────────


@pytest.fixture
def sample_article_text():
    """Raw article text loaded from the fixtures directory."""
    fixture_path = Path(__file__).parent / "fixtures" / "sample_article.txt"
    return fixture_path.read_text()


@pytest.fixture
def sample_person(db_session):
    """One elected official and one staff member."""
    elected = Person(
        name="Sen. Margaret Holloway",
        type=SpeakerType.elected,
        party=Party.democrat,
        role="U.S. Senator",
        chamber=Chamber.senate,
        locales=["CA"],
    )
    staff = Person(
        name="David Nakamura",
        type=SpeakerType.staff,
        role="Chief of Staff",
        employer="Office of Sen. Holloway",
    )
    db_session.add_all([elected, staff])
    db_session.commit()
    db_session.refresh(elected)
    db_session.refresh(staff)
    return elected, staff


@pytest.fixture
def sample_article(db_session):
    """A minimal article record."""
    article = Article(
        url="https://example.com/ai-regulation-hearing",
        title="Senate Panel Weighs New AI Oversight Rules",
        publication="Example News",
        published_date=date(2025, 9, 15),
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    return article


@pytest.fixture
def sample_quote(db_session, sample_person, sample_article):
    """A single quote linked to the elected person and the sample article."""
    elected, _ = sample_person
    quote = Quote(
        person_id=elected.id,
        article_id=sample_article.id,
        quote_text=(
            "We cannot afford to wait another session while this "
            "technology reshapes every sector of our economy."
        ),
        context="Speaking at a Senate Commerce Committee hearing on AI regulation.",
        date_said=date(2025, 9, 15),
        date_recorded=date(2025, 9, 15),
    )
    db_session.add(quote)
    db_session.commit()
    db_session.refresh(quote)
    return quote
