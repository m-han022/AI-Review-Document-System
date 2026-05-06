"""add active gradingrun unique index

Revision ID: 8f4a9e0b4c1d
Revises: 670a9a71789a
Create Date: 2026-05-06 11:05:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "8f4a9e0b4c1d"
down_revision: Union[str, None] = "670a9a71789a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = "uq_gradingrun_active_eval_context"
ACTIVE_WHERE = "status IN ('PENDING','EXTRACTING','GRADING')"


def upgrade() -> None:
    op.execute(
        f"""
        CREATE UNIQUE INDEX IF NOT EXISTS {INDEX_NAME}
        ON gradingrun (document_version_id, evaluation_set_id, lower(prompt_level))
        WHERE {ACTIVE_WHERE}
        """
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {INDEX_NAME}")

