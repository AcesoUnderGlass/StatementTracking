"""Convert people.locale string to people.locales JSON array

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-04-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "people",
        sa.Column("locales", sa.JSON(), nullable=False, server_default="[]"),
    )

    conn = op.get_bind()
    dialect = conn.dialect.name

    if dialect == "sqlite":
        conn.execute(
            sa.text(
                "UPDATE people SET locales = json_array(locale) "
                "WHERE locale IS NOT NULL AND locale != ''"
            )
        )
    else:
        conn.execute(
            sa.text(
                "UPDATE people SET locales = json_build_array(locale) "
                "WHERE locale IS NOT NULL AND locale != ''"
            )
        )

    with op.batch_alter_table("people") as batch_op:
        batch_op.drop_column("locale")


def downgrade() -> None:
    op.add_column(
        "people",
        sa.Column("locale", sa.String(50), nullable=True),
    )

    conn = op.get_bind()
    dialect = conn.dialect.name

    if dialect == "sqlite":
        conn.execute(
            sa.text(
                "UPDATE people SET locale = json_extract(locales, '$[0]') "
                "WHERE locales IS NOT NULL AND json_array_length(locales) > 0"
            )
        )
    else:
        conn.execute(
            sa.text(
                "UPDATE people SET locale = locales->>0 "
                "WHERE locales IS NOT NULL AND json_array_length(locales) > 0"
            )
        )

    with op.batch_alter_table("people") as batch_op:
        batch_op.drop_column("locales")
