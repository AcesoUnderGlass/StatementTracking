"""add deepfake topic

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-04-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TOPIC_NAME = "deepfake"


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name
    if dialect == "postgresql":
        conn.execute(
            sa.text(
                "INSERT INTO topics (name) VALUES (:name) "
                "ON CONFLICT (name) DO NOTHING"
            ),
            {"name": TOPIC_NAME},
        )
    else:
        # SQLite (tests) and other dialects with UNIQUE on name
        conn.execute(
            sa.text(
                "INSERT OR IGNORE INTO topics (name) VALUES (:name)"
            ),
            {"name": TOPIC_NAME},
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM quote_topics WHERE topic_id = "
            "(SELECT id FROM topics WHERE name = :name)"
        ),
        {"name": TOPIC_NAME},
    )
    conn.execute(
        sa.text("DELETE FROM topics WHERE name = :name"),
        {"name": TOPIC_NAME},
    )
