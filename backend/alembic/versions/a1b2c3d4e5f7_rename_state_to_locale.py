"""rename people.state to people.locale

Revision ID: a1b2c3d4e5f7
Revises: f7a8b9c0d1e2
Create Date: 2026-04-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("people") as batch_op:
        batch_op.alter_column("state", new_column_name="locale", type_=sa.String(50), existing_type=sa.String(2))


def downgrade() -> None:
    with op.batch_alter_table("people") as batch_op:
        batch_op.alter_column("locale", new_column_name="state", type_=sa.String(2), existing_type=sa.String(50))
