import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./quotes.db")

# Strip surrounding quotes/whitespace that may be accidentally included
DATABASE_URL = DATABASE_URL.strip().strip("'\"")

if not DATABASE_URL:
    print("WARNING: DATABASE_URL is empty, falling back to sqlite", file=sys.stderr)
    DATABASE_URL = "sqlite:///./quotes.db"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Remove channel_binding param which some drivers/proxies don't support
if "channel_binding" in DATABASE_URL:
    import re
    DATABASE_URL = re.sub(r"[&?]channel_binding=[^&]*", "", DATABASE_URL)
    # Fix dangling ? if channel_binding was the only param
    DATABASE_URL = DATABASE_URL.replace("?&", "?").rstrip("?")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
except Exception as e:
    masked = DATABASE_URL[:25] + "..." if len(DATABASE_URL) > 25 else DATABASE_URL
    print(f"Failed to create engine with DATABASE_URL={masked!r}: {e}", file=sys.stderr)
    raise
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
