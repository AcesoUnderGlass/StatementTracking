"""add quote_favorites table

Revision ID: i1j2k3l4m5n6
Revises: h0i1j2k3l4m5
Create Date: 2026-05-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i1j2k3l4m5n6"
down_revision: Union[str, Sequence[str], None] = "h0i1j2k3l4m5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quote_favorites",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("quote_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["quote_id"], ["quotes.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "quote_id"),
    )
    op.create_index(
        "ix_quote_favorites_quote_id",
        "quote_favorites",
        ["quote_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_quote_favorites_quote_id", table_name="quote_favorites"
    )
    op.drop_table("quote_favorites")
