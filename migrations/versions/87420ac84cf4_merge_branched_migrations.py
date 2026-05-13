"""merge branched migrations

Revision ID: 87420ac84cf4
Revises: 1ca236268ab0, fd8ffc46892c
Create Date: 2026-05-13 13:17:13.929687

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '87420ac84cf4'
down_revision = ('1ca236268ab0', 'fd8ffc46892c')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
