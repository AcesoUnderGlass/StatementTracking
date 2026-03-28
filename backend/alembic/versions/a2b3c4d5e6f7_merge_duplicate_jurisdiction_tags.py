"""merge duplicate jurisdiction tags (USA-Federal → USA-federal)

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    canonical = conn.execute(
        sa.text("SELECT id FROM jurisdictions WHERE name = 'USA-federal'")
    ).fetchone()
    if not canonical:
        return

    canonical_id = canonical[0]

    dupes = conn.execute(
        sa.text(
            "SELECT id FROM jurisdictions "
            "WHERE LOWER(name) = LOWER('USA-federal') AND id != :canonical_id"
        ),
        {"canonical_id": canonical_id},
    ).fetchall()

    for (dupe_id,) in dupes:
        conn.execute(
            sa.text(
                "UPDATE quote_jurisdictions SET jurisdiction_id = :canonical_id "
                "WHERE jurisdiction_id = :dupe_id "
                "AND quote_id NOT IN ("
                "  SELECT quote_id FROM quote_jurisdictions WHERE jurisdiction_id = :canonical_id"
                ")"
            ),
            {"canonical_id": canonical_id, "dupe_id": dupe_id},
        )
        conn.execute(
            sa.text(
                "DELETE FROM quote_jurisdictions WHERE jurisdiction_id = :dupe_id"
            ),
            {"dupe_id": dupe_id},
        )
        conn.execute(
            sa.text("DELETE FROM jurisdictions WHERE id = :dupe_id"),
            {"dupe_id": dupe_id},
        )


def downgrade() -> None:
    pass
