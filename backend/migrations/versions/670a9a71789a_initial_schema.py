"""Initial schema

Revision ID: 670a9a71789a
Revises: 
Create Date: 2026-05-04 09:57:29.667953

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '670a9a71789a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "evaluationpolicy",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("level", sa.String(), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.String(), nullable=False, server_default=""),
        sa.UniqueConstraint("level", "version", name="uq_policy_level_version"),
    )
    op.create_index(op.f("ix_evaluationpolicy_level"), "evaluationpolicy", ["level"], unique=False)
    op.create_index(op.f("ix_evaluationpolicy_status"), "evaluationpolicy", ["status"], unique=False)
    op.create_index(op.f("ix_evaluationpolicy_version"), "evaluationpolicy", ["version"], unique=False)

    op.create_table(
        "promptversion",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("document_type", sa.String(), nullable=False),
        sa.Column("level", sa.String(), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.String(), nullable=False, server_default=""),
        sa.UniqueConstraint("document_type", "level", "version", name="uq_prompt_type_level_version"),
    )
    op.create_index(op.f("ix_promptversion_document_type"), "promptversion", ["document_type"], unique=False)
    op.create_index(op.f("ix_promptversion_level"), "promptversion", ["level"], unique=False)
    op.create_index(op.f("ix_promptversion_status"), "promptversion", ["status"], unique=False)
    op.create_index(op.f("ix_promptversion_version"), "promptversion", ["version"], unique=False)

    op.create_table(
        "rubric",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("document_type", sa.String(), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("prompt", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
        sa.UniqueConstraint("document_type", "version", name="uq_rubric_document_type_version"),
    )
    op.create_index(op.f("ix_rubric_active"), "rubric", ["active"], unique=False)
    op.create_index(op.f("ix_rubric_document_type"), "rubric", ["document_type"], unique=False)
    op.create_index(op.f("ix_rubric_status"), "rubric", ["status"], unique=False)
    op.create_index(op.f("ix_rubric_version"), "rubric", ["version"], unique=False)

    op.create_table(
        "submission",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("project_name", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("document_type", sa.String(), nullable=False, server_default="project-review"),
        sa.Column("language", sa.String(), nullable=False, server_default="ja"),
        sa.Column("file_path", sa.String(), nullable=True),
        sa.Column("uploaded_at", sa.String(), nullable=False, server_default=""),
        sa.Column("status", sa.String(), nullable=False, server_default="uploaded"),
        sa.Column("project_description", sa.String(), nullable=True),
        sa.Column("latest_grading_run_id", sa.Integer(), nullable=True),
        sa.UniqueConstraint("project_id"),
    )
    op.create_index(op.f("ix_submission_document_type"), "submission", ["document_type"], unique=False)
    op.create_index(op.f("ix_submission_language"), "submission", ["language"], unique=False)
    op.create_index(op.f("ix_submission_project_id"), "submission", ["project_id"], unique=False)
    op.create_index(op.f("ix_submission_status"), "submission", ["status"], unique=False)

    op.create_table(
        "submission_document",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submission.id"), nullable=False),
        sa.Column("document_type", sa.String(), nullable=False),
        sa.Column("document_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
        sa.Column("is_latest", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("submission_id", "document_type", "document_name", name="uq_submission_document_identity"),
    )
    op.create_index(op.f("ix_submission_document_document_name"), "submission_document", ["document_name"], unique=False)
    op.create_index(op.f("ix_submission_document_document_type"), "submission_document", ["document_type"], unique=False)
    op.create_index(op.f("ix_submission_document_is_latest"), "submission_document", ["is_latest"], unique=False)
    op.create_index(op.f("ix_submission_document_submission_id"), "submission_document", ["submission_id"], unique=False)

    op.create_table(
        "submissioncontent",
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submission.id"), primary_key=True, nullable=False),
        sa.Column("extracted_text", sa.String(), nullable=False),
        sa.Column("content_hash", sa.String(), nullable=False),
    )
    op.create_index(op.f("ix_submissioncontent_content_hash"), "submissioncontent", ["content_hash"], unique=False)

    op.create_table(
        "submission_document_version",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submission.id"), nullable=False),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("submission_document.id"), nullable=True),
        sa.Column("document_version", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=True),
        sa.Column("extracted_text", sa.String(), nullable=False),
        sa.Column("content_hash", sa.String(), nullable=False),
        sa.Column("language", sa.String(), nullable=False, server_default="ja"),
        sa.Column("uploaded_at", sa.String(), nullable=False, server_default=""),
        sa.Column("is_latest", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("document_id", "document_version", name="uq_document_version"),
    )
    op.create_index(op.f("ix_submission_document_version_content_hash"), "submission_document_version", ["content_hash"], unique=False)
    op.create_index(op.f("ix_submission_document_version_document_id"), "submission_document_version", ["document_id"], unique=False)
    op.create_index(op.f("ix_submission_document_version_document_version"), "submission_document_version", ["document_version"], unique=False)
    op.create_index(op.f("ix_submission_document_version_is_latest"), "submission_document_version", ["is_latest"], unique=False)
    op.create_index(op.f("ix_submission_document_version_language"), "submission_document_version", ["language"], unique=False)
    op.create_index(op.f("ix_submission_document_version_submission_id"), "submission_document_version", ["submission_id"], unique=False)

    op.create_table(
        "gradingrun",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submission.id"), nullable=False),
        sa.Column("document_version_id", sa.Integer(), sa.ForeignKey("submission_document_version.id"), nullable=True),
        sa.Column("document_version", sa.String(), nullable=True),
        sa.Column("rubric_id", sa.Integer(), sa.ForeignKey("rubric.id"), nullable=True),
        sa.Column("rubric_version", sa.String(), nullable=True),
        sa.Column("rubric_hash", sa.String(), nullable=True),
        sa.Column("gemini_model", sa.String(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("total_score", sa.Integer(), nullable=True),
        sa.Column("draft_feedback", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="completed"),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("content_hash", sa.String(), nullable=False),
        sa.Column("prompt_version", sa.String(), nullable=True),
        sa.Column("prompt_level", sa.String(), nullable=True, server_default="medium"),
        sa.Column("policy_version", sa.String(), nullable=True),
        sa.Column("policy_hash", sa.String(), nullable=True),
        sa.Column("required_rule_hash", sa.String(), nullable=True),
        sa.Column("prompt_hash", sa.String(), nullable=True),
        sa.Column("criteria_hash", sa.String(), nullable=True),
        sa.Column("grading_schema_version", sa.String(), nullable=True),
        sa.Column("started_at", sa.String(), nullable=False, server_default=""),
        sa.Column("graded_at", sa.String(), nullable=True),
    )
    op.create_index(op.f("ix_gradingrun_content_hash"), "gradingrun", ["content_hash"], unique=False)
    op.create_index(op.f("ix_gradingrun_criteria_hash"), "gradingrun", ["criteria_hash"], unique=False)
    op.create_index(op.f("ix_gradingrun_document_version"), "gradingrun", ["document_version"], unique=False)
    op.create_index(op.f("ix_gradingrun_document_version_id"), "gradingrun", ["document_version_id"], unique=False)
    op.create_index(op.f("ix_gradingrun_graded_at"), "gradingrun", ["graded_at"], unique=False)
    op.create_index(op.f("ix_gradingrun_grading_schema_version"), "gradingrun", ["grading_schema_version"], unique=False)
    op.create_index(op.f("ix_gradingrun_policy_hash"), "gradingrun", ["policy_hash"], unique=False)
    op.create_index(op.f("ix_gradingrun_policy_version"), "gradingrun", ["policy_version"], unique=False)
    op.create_index(op.f("ix_gradingrun_prompt_hash"), "gradingrun", ["prompt_hash"], unique=False)
    op.create_index(op.f("ix_gradingrun_prompt_level"), "gradingrun", ["prompt_level"], unique=False)
    op.create_index(op.f("ix_gradingrun_prompt_version"), "gradingrun", ["prompt_version"], unique=False)
    op.create_index(op.f("ix_gradingrun_required_rule_hash"), "gradingrun", ["required_rule_hash"], unique=False)
    op.create_index(op.f("ix_gradingrun_rubric_hash"), "gradingrun", ["rubric_hash"], unique=False)
    op.create_index(op.f("ix_gradingrun_score"), "gradingrun", ["score"], unique=False)
    op.create_index(op.f("ix_gradingrun_status"), "gradingrun", ["status"], unique=False)
    op.create_index(op.f("ix_gradingrun_submission_id"), "gradingrun", ["submission_id"], unique=False)
    op.create_index(op.f("ix_gradingrun_total_score"), "gradingrun", ["total_score"], unique=False)

    op.create_table(
        "gradingcriteriaresult",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("grading_run_id", sa.Integer(), sa.ForeignKey("gradingrun.id"), nullable=False),
        sa.Column("criterion_key", sa.String(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("max_score", sa.Float(), nullable=False),
        sa.Column("suggestion", sa.JSON(), nullable=True),
        sa.UniqueConstraint("grading_run_id", "criterion_key", name="uq_grading_run_criterion"),
    )
    op.create_index(op.f("ix_gradingcriteriaresult_criterion_key"), "gradingcriteriaresult", ["criterion_key"], unique=False)
    op.create_index(op.f("ix_gradingcriteriaresult_grading_run_id"), "gradingcriteriaresult", ["grading_run_id"], unique=False)

    op.create_table(
        "gradingslidereview",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("grading_run_id", sa.Integer(), sa.ForeignKey("gradingrun.id"), nullable=False),
        sa.Column("slide_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="NG"),
        sa.Column("title", sa.JSON(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("issues", sa.JSON(), nullable=True),
        sa.Column("suggestions", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False, server_default=""),
        sa.UniqueConstraint("grading_run_id", "slide_number", name="uq_grading_run_slide"),
    )
    op.create_index(op.f("ix_gradingslidereview_grading_run_id"), "gradingslidereview", ["grading_run_id"], unique=False)
    op.create_index(op.f("ix_gradingslidereview_slide_number"), "gradingslidereview", ["slide_number"], unique=False)
    op.create_index(op.f("ix_gradingslidereview_status"), "gradingslidereview", ["status"], unique=False)

    op.create_table(
        "rubriccriterionrecord",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("rubric_id", sa.Integer(), sa.ForeignKey("rubric.id"), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("max_score", sa.Float(), nullable=False),
        sa.Column("label_vi", sa.String(), nullable=False),
        sa.Column("label_ja", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("rubric_id", "key", name="uq_rubric_criterion_key"),
    )
    op.create_index(op.f("ix_rubriccriterionrecord_key"), "rubriccriterionrecord", ["key"], unique=False)
    op.create_index(op.f("ix_rubriccriterionrecord_rubric_id"), "rubriccriterionrecord", ["rubric_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_rubriccriterionrecord_rubric_id"), table_name="rubriccriterionrecord")
    op.drop_index(op.f("ix_rubriccriterionrecord_key"), table_name="rubriccriterionrecord")
    op.drop_table("rubriccriterionrecord")

    op.drop_index(op.f("ix_gradingslidereview_status"), table_name="gradingslidereview")
    op.drop_index(op.f("ix_gradingslidereview_slide_number"), table_name="gradingslidereview")
    op.drop_index(op.f("ix_gradingslidereview_grading_run_id"), table_name="gradingslidereview")
    op.drop_table("gradingslidereview")

    op.drop_index(op.f("ix_gradingcriteriaresult_grading_run_id"), table_name="gradingcriteriaresult")
    op.drop_index(op.f("ix_gradingcriteriaresult_criterion_key"), table_name="gradingcriteriaresult")
    op.drop_table("gradingcriteriaresult")

    op.drop_index(op.f("ix_gradingrun_total_score"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_submission_id"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_status"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_score"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_rubric_hash"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_required_rule_hash"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_prompt_version"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_prompt_level"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_prompt_hash"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_policy_version"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_policy_hash"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_grading_schema_version"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_graded_at"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_document_version_id"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_document_version"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_criteria_hash"), table_name="gradingrun")
    op.drop_index(op.f("ix_gradingrun_content_hash"), table_name="gradingrun")
    op.drop_table("gradingrun")

    op.drop_index(op.f("ix_submission_document_version_submission_id"), table_name="submission_document_version")
    op.drop_index(op.f("ix_submission_document_version_language"), table_name="submission_document_version")
    op.drop_index(op.f("ix_submission_document_version_is_latest"), table_name="submission_document_version")
    op.drop_index(op.f("ix_submission_document_version_document_version"), table_name="submission_document_version")
    op.drop_index(op.f("ix_submission_document_version_document_id"), table_name="submission_document_version")
    op.drop_index(op.f("ix_submission_document_version_content_hash"), table_name="submission_document_version")
    op.drop_table("submission_document_version")

    op.drop_index(op.f("ix_submissioncontent_content_hash"), table_name="submissioncontent")
    op.drop_table("submissioncontent")

    op.drop_index(op.f("ix_submission_document_submission_id"), table_name="submission_document")
    op.drop_index(op.f("ix_submission_document_is_latest"), table_name="submission_document")
    op.drop_index(op.f("ix_submission_document_document_type"), table_name="submission_document")
    op.drop_index(op.f("ix_submission_document_document_name"), table_name="submission_document")
    op.drop_table("submission_document")

    op.drop_index(op.f("ix_submission_status"), table_name="submission")
    op.drop_index(op.f("ix_submission_project_id"), table_name="submission")
    op.drop_index(op.f("ix_submission_language"), table_name="submission")
    op.drop_index(op.f("ix_submission_document_type"), table_name="submission")
    op.drop_table("submission")

    op.drop_index(op.f("ix_rubric_version"), table_name="rubric")
    op.drop_index(op.f("ix_rubric_status"), table_name="rubric")
    op.drop_index(op.f("ix_rubric_document_type"), table_name="rubric")
    op.drop_index(op.f("ix_rubric_active"), table_name="rubric")
    op.drop_table("rubric")

    op.drop_index(op.f("ix_promptversion_version"), table_name="promptversion")
    op.drop_index(op.f("ix_promptversion_status"), table_name="promptversion")
    op.drop_index(op.f("ix_promptversion_level"), table_name="promptversion")
    op.drop_index(op.f("ix_promptversion_document_type"), table_name="promptversion")
    op.drop_table("promptversion")

    op.drop_index(op.f("ix_evaluationpolicy_version"), table_name="evaluationpolicy")
    op.drop_index(op.f("ix_evaluationpolicy_status"), table_name="evaluationpolicy")
    op.drop_index(op.f("ix_evaluationpolicy_level"), table_name="evaluationpolicy")
    op.drop_table("evaluationpolicy")
