"""add performance indexes for home page queries

Revision ID: d3e4f5a6b7c8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX ix_quotes_status_dup_date_said "
        "ON quotes (review_status, is_duplicate, date_said DESC)"
    )
    op.execute(
        "CREATE INDEX ix_quotes_status_dup_created_at "
        "ON quotes (review_status, is_duplicate, created_at DESC)"
    )
    op.create_index("ix_quotes_person_id", "quotes", ["person_id"])
    op.create_index("ix_quote_jurisdictions_quote_id", "quote_jurisdictions", ["quote_id"])
    op.create_index("ix_quote_jurisdictions_jurisdiction_id", "quote_jurisdictions", ["jurisdiction_id"])
    op.create_index("ix_quote_topics_quote_id", "quote_topics", ["quote_id"])
    op.create_index("ix_quote_topics_topic_id", "quote_topics", ["topic_id"])


def downgrade() -> None:
    op.drop_index("ix_quote_topics_topic_id", table_name="quote_topics")
    op.drop_index("ix_quote_topics_quote_id", table_name="quote_topics")
    op.drop_index("ix_quote_jurisdictions_jurisdiction_id", table_name="quote_jurisdictions")
    op.drop_index("ix_quote_jurisdictions_quote_id", table_name="quote_jurisdictions")
    op.drop_index("ix_quotes_person_id", table_name="quotes")
    op.drop_index("ix_quotes_status_dup_created_at", table_name="quotes")
    op.drop_index("ix_quotes_status_dup_date_said", table_name="quotes")
