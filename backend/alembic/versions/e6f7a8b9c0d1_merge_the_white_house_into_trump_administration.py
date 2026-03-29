"""merge The White House speaker into Trump administration for post-2024 quotes

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-03-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CANONICAL_NAME = "Trump administration"
CUTOFF = "2024-12-31"


def upgrade() -> None:
    conn = op.get_bind()

    wh_rows = conn.execute(
        sa.text(
            "SELECT id FROM people "
            "WHERE LOWER(TRIM(name)) IN ('the white house', 'white house')"
        )
    ).fetchall()
    if not wh_rows:
        return

    wh_ids = [r[0] for r in wh_rows]

    canonical = conn.execute(
        sa.text(
            "SELECT id FROM people WHERE LOWER(TRIM(name)) = 'trump administration'"
        )
    ).fetchone()

    if canonical:
        canonical_id = canonical[0]
    else:
        canonical_id = wh_ids[0]
        conn.execute(
            sa.text("UPDATE people SET name = :name WHERE id = :id"),
            {"name": CANONICAL_NAME, "id": canonical_id},
        )

    for wh_id in wh_ids:
        if wh_id == canonical_id:
            continue

        conn.execute(
            sa.text(
                "UPDATE quotes SET person_id = :cid "
                "WHERE person_id = :oid "
                "AND (date_said > :cutoff OR date_said IS NULL)"
            ),
            {"cid": canonical_id, "oid": wh_id, "cutoff": CUTOFF},
        )

        remaining = conn.execute(
            sa.text("SELECT COUNT(*) FROM quotes WHERE person_id = :id"),
            {"id": wh_id},
        ).scalar()
        if remaining == 0:
            conn.execute(
                sa.text("DELETE FROM people WHERE id = :id"), {"id": wh_id}
            )


def downgrade() -> None:
    pass
