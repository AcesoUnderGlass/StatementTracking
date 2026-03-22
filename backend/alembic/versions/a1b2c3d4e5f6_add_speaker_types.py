"""add think_tank and gov_inst speaker types

Revision ID: a1b2c3d4e5f6
Revises: 0f00667952f4
Create Date: 2026-03-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '0f00667952f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('people', schema=None) as batch_op:
        batch_op.alter_column(
            'type',
            existing_type=sa.Enum('elected', 'staff', name='persontype'),
            type_=sa.Enum(
                'elected', 'staff', 'think_tank', 'gov_inst',
                name='speakertype',
            ),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table('people', schema=None) as batch_op:
        batch_op.alter_column(
            'type',
            existing_type=sa.Enum(
                'elected', 'staff', 'think_tank', 'gov_inst',
                name='speakertype',
            ),
            type_=sa.Enum('elected', 'staff', name='persontype'),
            existing_nullable=False,
        )
