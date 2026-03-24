"""add World jurisdiction tag

Revision ID: e7f8a9b0c1d2
Revises: c4d8a2f1e3b5
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "c4d8a2f1e3b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    jurisdictions = sa.table(
        "jurisdictions",
        sa.column("name", sa.String()),
        sa.column("abbreviation", sa.String()),
        sa.column("category", sa.String()),
    )
    op.bulk_insert(
        jurisdictions,
        [
            {
                "name": "World",
                "abbreviation": "WLD",
                "category": "international",
            }
        ],
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM jurisdictions WHERE name = 'World'"))
