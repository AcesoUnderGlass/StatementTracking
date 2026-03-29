"""merge Person rows named "Trump White House" into Trump administration

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-03-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CANONICAL_NAME = "Trump administration"


def upgrade() -> None:
    conn = op.get_bind()
    alias_rows = conn.execute(
        sa.text(
            "SELECT id, name FROM people WHERE LOWER(TRIM(name)) = 'trump white house'"
        )
    ).fetchall()
    if not alias_rows:
        return

    canonical = conn.execute(
        sa.text(
            "SELECT id FROM people WHERE LOWER(TRIM(name)) = 'trump administration'"
        )
    ).fetchone()

    if canonical:
        canonical_id = canonical[0]
        for (other_id, _) in alias_rows:
            if other_id == canonical_id:
                continue
            conn.execute(
                sa.text("UPDATE quotes SET person_id = :cid WHERE person_id = :oid"),
                {"cid": canonical_id, "oid": other_id},
            )
            conn.execute(sa.text("DELETE FROM people WHERE id = :oid"), {"oid": other_id})
        conn.execute(
            sa.text("UPDATE people SET name = :name WHERE id = :id"),
            {"name": CANONICAL_NAME, "id": canonical_id},
        )
    else:
        canonical_id = alias_rows[0][0]
        conn.execute(
            sa.text("UPDATE people SET name = :name WHERE id = :id"),
            {"name": CANONICAL_NAME, "id": canonical_id},
        )
        for (other_id, _) in alias_rows[1:]:
            conn.execute(
                sa.text("UPDATE quotes SET person_id = :cid WHERE person_id = :oid"),
                {"cid": canonical_id, "oid": other_id},
            )
            conn.execute(sa.text("DELETE FROM people WHERE id = :oid"), {"oid": other_id})


def downgrade() -> None:
    pass
