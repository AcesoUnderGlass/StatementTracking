"""add jurisdictions

Revision ID: c4d8a2f1e3b5
Revises: b9a1178a1f9c
Create Date: 2026-03-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d8a2f1e3b5'
down_revision: Union[str, Sequence[str], None] = 'b9a1178a1f9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JURISDICTIONS = [
    # Federal / international
    {"name": "USA-federal", "abbreviation": "US", "category": "federal"},
    # Abbreviation avoids collision with California (CA)
    {"name": "Canada-federal", "abbreviation": "CAN", "category": "federal"},
    {"name": "EU", "abbreviation": "EU", "category": "international"},
    {"name": "UK-federal", "abbreviation": "UK", "category": "federal"},
    # Meta-tags
    {"name": "US-state", "abbreviation": None, "category": "meta"},
    {"name": "US-local", "abbreviation": None, "category": "meta"},
    # 50 US states
    {"name": "Alabama", "abbreviation": "AL", "category": "state"},
    {"name": "Alaska", "abbreviation": "AK", "category": "state"},
    {"name": "Arizona", "abbreviation": "AZ", "category": "state"},
    {"name": "Arkansas", "abbreviation": "AR", "category": "state"},
    {"name": "California", "abbreviation": "CA", "category": "state"},
    {"name": "Colorado", "abbreviation": "CO", "category": "state"},
    {"name": "Connecticut", "abbreviation": "CT", "category": "state"},
    {"name": "Delaware", "abbreviation": "DE", "category": "state"},
    {"name": "Florida", "abbreviation": "FL", "category": "state"},
    {"name": "Georgia", "abbreviation": "GA", "category": "state"},
    {"name": "Hawaii", "abbreviation": "HI", "category": "state"},
    {"name": "Idaho", "abbreviation": "ID", "category": "state"},
    {"name": "Illinois", "abbreviation": "IL", "category": "state"},
    {"name": "Indiana", "abbreviation": "IN", "category": "state"},
    {"name": "Iowa", "abbreviation": "IA", "category": "state"},
    {"name": "Kansas", "abbreviation": "KS", "category": "state"},
    {"name": "Kentucky", "abbreviation": "KY", "category": "state"},
    {"name": "Louisiana", "abbreviation": "LA", "category": "state"},
    {"name": "Maine", "abbreviation": "ME", "category": "state"},
    {"name": "Maryland", "abbreviation": "MD", "category": "state"},
    {"name": "Massachusetts", "abbreviation": "MA", "category": "state"},
    {"name": "Michigan", "abbreviation": "MI", "category": "state"},
    {"name": "Minnesota", "abbreviation": "MN", "category": "state"},
    {"name": "Mississippi", "abbreviation": "MS", "category": "state"},
    {"name": "Missouri", "abbreviation": "MO", "category": "state"},
    {"name": "Montana", "abbreviation": "MT", "category": "state"},
    {"name": "Nebraska", "abbreviation": "NE", "category": "state"},
    {"name": "Nevada", "abbreviation": "NV", "category": "state"},
    {"name": "New Hampshire", "abbreviation": "NH", "category": "state"},
    {"name": "New Jersey", "abbreviation": "NJ", "category": "state"},
    {"name": "New Mexico", "abbreviation": "NM", "category": "state"},
    {"name": "New York", "abbreviation": "NY", "category": "state"},
    {"name": "North Carolina", "abbreviation": "NC", "category": "state"},
    {"name": "North Dakota", "abbreviation": "ND", "category": "state"},
    {"name": "Ohio", "abbreviation": "OH", "category": "state"},
    {"name": "Oklahoma", "abbreviation": "OK", "category": "state"},
    {"name": "Oregon", "abbreviation": "OR", "category": "state"},
    {"name": "Pennsylvania", "abbreviation": "PA", "category": "state"},
    {"name": "Rhode Island", "abbreviation": "RI", "category": "state"},
    {"name": "South Carolina", "abbreviation": "SC", "category": "state"},
    {"name": "South Dakota", "abbreviation": "SD", "category": "state"},
    {"name": "Tennessee", "abbreviation": "TN", "category": "state"},
    {"name": "Texas", "abbreviation": "TX", "category": "state"},
    {"name": "Utah", "abbreviation": "UT", "category": "state"},
    {"name": "Vermont", "abbreviation": "VT", "category": "state"},
    {"name": "Virginia", "abbreviation": "VA", "category": "state"},
    {"name": "Washington", "abbreviation": "WA", "category": "state"},
    {"name": "West Virginia", "abbreviation": "WV", "category": "state"},
    {"name": "Wisconsin", "abbreviation": "WI", "category": "state"},
    {"name": "Wyoming", "abbreviation": "WY", "category": "state"},
]


def upgrade() -> None:
    jurisdictions_table = op.create_table(
        'jurisdictions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('abbreviation', sa.String(length=10), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    op.create_table(
        'quote_jurisdictions',
        sa.Column('quote_id', sa.Integer(), nullable=False),
        sa.Column('jurisdiction_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['jurisdiction_id'], ['jurisdictions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['quote_id'], ['quotes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('quote_id', 'jurisdiction_id'),
    )

    op.bulk_insert(jurisdictions_table, JURISDICTIONS)


def downgrade() -> None:
    op.drop_table('quote_jurisdictions')
    op.drop_table('jurisdictions')
