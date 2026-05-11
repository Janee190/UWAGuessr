"""added security question and answer to user model

Revision ID: 3c316765df09
Revises: 6ab845d87b06
Create Date: 2026-05-08 21:22:32.607996

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3c316765df09'
down_revision = '6ab845d87b06'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user', sa.Column('security_question', sa.String(length=256), nullable=True))
    op.add_column('user', sa.Column('security_answer_hash', sa.String(length=256), nullable=True))

def downgrade():
    op.drop_column('user', 'security_answer_hash')
    op.drop_column('user', 'security_question')