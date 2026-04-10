"""add commercial speaker type

Revision ID: g8h9i0j1k2l3
Revises: f7a8b9c0d1e2
Create Date: 2026-04-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g8h9i0j1k2l3"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name
    if dialect == "postgresql":
        op.execute("ALTER TYPE speakertype ADD VALUE IF NOT EXISTS 'commercial'")
    # SQLite: enum is stored as VARCHAR, no schema change needed.


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed; the value will remain harmless.
    pass
