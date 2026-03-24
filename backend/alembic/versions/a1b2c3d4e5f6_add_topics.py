"""add topics

Revision ID: a1b2c3d4e5f6
Revises: e7f8a9b0c1d2
Create Date: 2026-03-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TOPICS = [
    {"name": "regulation"},
    {"name": "AGI"},
    {"name": "x-risk"},
    {"name": "WMD"},
    {"name": "jobs"},
    {"name": "uses"},
]


def upgrade() -> None:
    topics_table = op.create_table(
        "topics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "quote_topics",
        sa.Column("quote_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["quote_id"], ["quotes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("quote_id", "topic_id"),
    )

    op.bulk_insert(topics_table, TOPICS)


def downgrade() -> None:
    op.drop_table("quote_topics")
    op.drop_table("topics")
