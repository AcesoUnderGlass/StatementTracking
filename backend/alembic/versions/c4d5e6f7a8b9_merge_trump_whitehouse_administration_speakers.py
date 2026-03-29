"""merge duplicate Trump White House / Trump administration speaker persons

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-03-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CANONICAL_NAME = "Trump administration"


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, name FROM people WHERE LOWER(TRIM(name)) IN "
            "('trump whitehouse', 'trump administration')"
        )
    ).fetchall()
    if not rows:
        return

    administration = [r for r in rows if r[1].strip().lower() == "trump administration"]
    if administration:
        canonical_id = administration[0][0]
    else:
        canonical_id = rows[0][0]

    for (other_id, _) in rows:
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


def downgrade() -> None:
    pass
