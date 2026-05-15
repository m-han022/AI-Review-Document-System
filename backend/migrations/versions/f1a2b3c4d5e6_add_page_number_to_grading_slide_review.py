"""add page_number to grading slide review

Revision ID: f1a2b3c4d5e6
Revises: e4f5b6a7c8d9
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "f1a2b3c4d5e6"
down_revision = "e4f5b6a7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("gradingslidereview", sa.Column("page_number", sa.Integer(), nullable=True))
    op.execute("UPDATE gradingslidereview SET page_number = slide_number WHERE page_number IS NULL")
    op.create_index(op.f("ix_gradingslidereview_page_number"), "gradingslidereview", ["page_number"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_gradingslidereview_page_number"), table_name="gradingslidereview")
    op.drop_column("gradingslidereview", "page_number")

