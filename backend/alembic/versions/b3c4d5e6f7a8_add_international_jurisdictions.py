"""add international jurisdictions and fix misclassified rows

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INTERNATIONAL_JURISDICTIONS = [
    {"name": "China", "abbreviation": "CN", "category": "international"},
    {"name": "Japan", "abbreviation": "JP", "category": "international"},
    {"name": "South Korea", "abbreviation": "KR", "category": "international"},
    {"name": "India", "abbreviation": "IN", "category": "international"},
    {"name": "Australia", "abbreviation": "AU", "category": "international"},
    {"name": "Singapore", "abbreviation": "SG", "category": "international"},
    {"name": "Israel", "abbreviation": "IL", "category": "international"},
    {"name": "Brazil", "abbreviation": "BR", "category": "international"},
    {"name": "UAE", "abbreviation": "AE", "category": "international"},
    {"name": "Saudi Arabia", "abbreviation": "SA", "category": "international"},
    {"name": "France", "abbreviation": "FR", "category": "international"},
    {"name": "Germany", "abbreviation": "DE", "category": "international"},
    {"name": "Italy", "abbreviation": "IT", "category": "international"},
    {"name": "Spain", "abbreviation": "ES", "category": "international"},
    {"name": "Netherlands", "abbreviation": "NL", "category": "international"},
    {"name": "Sweden", "abbreviation": "SE", "category": "international"},
    {"name": "Switzerland", "abbreviation": "CH", "category": "international"},
    {"name": "Taiwan", "abbreviation": "TW", "category": "international"},
    {"name": "Indonesia", "abbreviation": "ID", "category": "international"},
    {"name": "Mexico", "abbreviation": "MX", "category": "international"},
    {"name": "Nigeria", "abbreviation": "NG", "category": "international"},
    {"name": "Kenya", "abbreviation": "KE", "category": "international"},
    {"name": "South Africa", "abbreviation": "ZA", "category": "international"},
]

INTERNATIONAL_NAMES = [j["name"].lower() for j in INTERNATIONAL_JURISDICTIONS]


def upgrade() -> None:
    conn = op.get_bind()
    jurisdictions = sa.table(
        "jurisdictions",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("abbreviation", sa.String()),
        sa.column("category", sa.String()),
    )

    # Reclassify any country names that were previously created as "local"
    # (the old fallback category) — e.g. "China" tagged on a quote would have
    # been inserted as category="local", which incorrectly triggered US-local.
    for entry in INTERNATIONAL_JURISDICTIONS:
        conn.execute(
            jurisdictions.update()
            .where(sa.func.lower(jurisdictions.c.name) == entry["name"].lower())
            .where(jurisdictions.c.category.in_(["local", "other"]))
            .values(category="international", abbreviation=entry["abbreviation"])
        )

    # Insert rows that don't already exist
    for entry in INTERNATIONAL_JURISDICTIONS:
        exists = conn.execute(
            sa.select(jurisdictions.c.id).where(
                sa.func.lower(jurisdictions.c.name) == entry["name"].lower()
            )
        ).first()
        if not exists:
            conn.execute(jurisdictions.insert().values(**entry))


def downgrade() -> None:
    conn = op.get_bind()
    jurisdictions = sa.table(
        "jurisdictions",
        sa.column("name", sa.String()),
    )
    for entry in INTERNATIONAL_JURISDICTIONS:
        conn.execute(
            sa.delete(jurisdictions).where(
                sa.func.lower(jurisdictions.c.name) == entry["name"].lower()
            )
        )
