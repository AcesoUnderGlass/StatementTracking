"""add ingestion source and review status

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("ingestion_source", sa.String(50), nullable=True),
    )
    op.add_column(
        "articles",
        sa.Column("ingestion_source_detail", sa.String(512), nullable=True),
    )
    op.add_column(
        "quotes",
        sa.Column(
            "review_status",
            sa.String(20),
            nullable=False,
            server_default="approved",
        ),
    )


def downgrade() -> None:
    op.drop_column("quotes", "review_status")
    op.drop_column("articles", "ingestion_source_detail")
    op.drop_column("articles", "ingestion_source")
