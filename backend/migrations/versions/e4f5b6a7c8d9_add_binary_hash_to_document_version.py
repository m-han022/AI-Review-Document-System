"""add binary_hash to document_version

Revision ID: e4f5b6a7c8d9
Revises: a3d1c9f4b2e7
Create Date: 2026-05-10 02:45:00.000000

"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e4f5b6a7c8d9"
down_revision: Union[str, None] = "a3d1c9f4b2e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use op.get_bind() to check if column exists before adding
    # (Useful for existing dev environments where it was added manually)
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("submission_document_version")]
    
    if "binary_hash" not in columns:
        op.add_column(
            "submission_document_version",
            sa.Column("binary_hash", sa.String(), nullable=True)
        )
        # Also create an index for faster lookups
        op.create_index(
            "ix_submission_document_version_binary_hash",
            "submission_document_version",
            ["binary_hash"],
            unique=False
        )


def downgrade() -> None:
    op.drop_index("ix_submission_document_version_binary_hash", table_name="submission_document_version")
    op.drop_column("submission_document_version", "binary_hash")
