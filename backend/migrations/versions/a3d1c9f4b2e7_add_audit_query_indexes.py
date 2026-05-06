"""add audit query indexes

Revision ID: a3d1c9f4b2e7
Revises: 8f4a9e0b4c1d
Create Date: 2026-05-06 13:05:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a3d1c9f4b2e7"
down_revision: Union[str, None] = "8f4a9e0b4c1d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Index set dedicated to audit list/export read patterns:
    # filter by status/time and sort by graded_at desc + id desc.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_gradingrun_status_graded_at_id
        ON gradingrun (status, graded_at, id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_gradingrun_docver_status_graded_at
        ON gradingrun (document_version_id, status, graded_at)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_gradingrun_docver_status_graded_at")
    op.execute("DROP INDEX IF EXISTS ix_gradingrun_status_graded_at_id")

