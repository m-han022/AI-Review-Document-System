from pydantic import BaseModel
from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, Literal, Dict, Any


# Supported languages
LanguageCode = Literal["vi", "ja"]
RubricStatus = Literal["draft", "active", "archived"]
PromptLevel = Literal["low", "medium", "high"]
ItemStatus = str # Literal["active", "archived"]


class Submission(SQLModel, table=True):
    """
    Represents a Project (Submission).
    As per AGENTS.md v2, this should not contain document-specific data.
    Legacy fields are kept for backward compatibility.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: str = Field(index=True, unique=True)
    project_name: str
    
    # Legacy fields (Superseded by SubmissionDocument and SubmissionDocumentVersion)
    filename: str  # Legacy: Use SubmissionDocumentVersion.original_filename
    document_type: str = Field(default="project-review", index=True)  # Legacy: Use SubmissionDocument.document_type
    language: str = Field(default="ja", index=True)  # Legacy: Use SubmissionDocumentVersion.language
    file_path: Optional[str] = None  # Legacy: Use SubmissionDocumentVersion.file_path
    uploaded_at: str = ""  # Legacy: Use SubmissionDocumentVersion.uploaded_at
    
    status: str = Field(default="uploaded", index=True)
    project_description: Optional[str] = None
    latest_grading_run_id: Optional[int] = Field(default=None, foreign_key="gradingrun.id")


class SubmissionContent(SQLModel, table=True):
    submission_id: int = Field(primary_key=True, foreign_key="submission.id")
    extracted_text: str
    content_hash: str = Field(index=True)


class SubmissionDocument(SQLModel, table=True):
    __tablename__ = "submission_document"
    __table_args__ = (
        UniqueConstraint("submission_id", "document_type", "document_name", name="uq_submission_document_identity"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    submission_id: int = Field(foreign_key="submission.id", index=True)
    document_type: str = Field(index=True)
    document_name: str = Field(index=True)
    created_at: str = ""
    updated_at: str = ""
    is_latest: bool = Field(default=True, index=True)


class SubmissionDocumentVersion(SQLModel, table=True):
    __tablename__ = "submission_document_version"
    __table_args__ = (
        UniqueConstraint("document_id", "document_version", name="uq_document_version"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    submission_id: int = Field(foreign_key="submission.id", index=True)
    document_id: Optional[int] = Field(default=None, foreign_key="submission_document.id", index=True)
    document_version: str = Field(index=True)
    filename: str
    original_filename: str
    file_path: Optional[str] = None
    extracted_text: str
    content_hash: str = Field(index=True)
    language: str = Field(default="ja", index=True)
    uploaded_at: str = ""
    is_latest: bool = Field(default=True, index=True)


class Rubric(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("document_type", "version", name="uq_rubric_document_type_version"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    document_type: str = Field(index=True)
    version: str = Field(index=True)
    active: bool = Field(default=False, index=True)
    status: ItemStatus = Field(default="active", index=True)
    prompt: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: str = ""
    updated_at: str = ""


class RubricCriterionRecord(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("rubric_id", "key", name="uq_rubric_criterion_key"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    rubric_id: int = Field(foreign_key="rubric.id", index=True)
    key: str = Field(index=True)
    max_score: float
    label_vi: str
    label_ja: str
    sort_order: int = 0


class EvaluationPolicy(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("level", "version", name="uq_policy_level_version"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    level: str = Field(index=True)
    version: str = Field(index=True)
    content: str
    status: ItemStatus = Field(default="active", index=True)
    created_at: str = ""


class RequiredRuleSet(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("version", name="uq_required_rule_set_version"),
        UniqueConstraint("hash", name="uq_required_rule_set_hash"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    version: str = Field(index=True)
    hash: str = Field(index=True)
    content: str
    status: ItemStatus = Field(default="active", index=True)
    created_at: str = ""


class PromptVersion(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("document_type", "level", "version", name="uq_prompt_type_level_version"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    document_type: str = Field(index=True)
    level: str = Field(index=True)
    version: str = Field(index=True)
    content: str
    status: ItemStatus = Field(default="active", index=True)
    created_at: str = ""

class EvaluationSet(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("document_type", "level", "name", name="uq_evalset_scope_name"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    document_type: str = Field(index=True)
    level: str = Field(index=True)
    rubric_version_id: int = Field(foreign_key="rubric.id", index=True)
    prompt_version_id: int = Field(foreign_key="promptversion.id", index=True)
    policy_version_id: int = Field(foreign_key="evaluationpolicy.id", index=True)
    required_rule_set_id: Optional[int] = Field(default=None, foreign_key="requiredruleset.id", index=True)
    required_rules_version: str = Field(default="system-rules-v1")
    required_rule_hash: str = Field(index=True)
    version_label: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="active", index=True)
    created_at: str = ""


class GradingRun(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    submission_id: int = Field(foreign_key="submission.id", index=True)
    document_version_id: Optional[int] = Field(default=None, foreign_key="submission_document_version.id", index=True)
    document_version: Optional[str] = Field(default=None, index=True)
    rubric_id: Optional[int] = Field(default=None, foreign_key="rubric.id", index=True)
    rubric_version: Optional[str] = None
    rubric_hash: Optional[str] = Field(default=None, index=True)
    gemini_model: Optional[str] = None
    score: Optional[int] = Field(default=None, index=True)
    total_score: Optional[int] = Field(default=None, index=True)
    draft_feedback: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    status: str = Field(default="completed", index=True)
    error_message: Optional[str] = None
    content_hash: str = Field(index=True)
    prompt_version: Optional[str] = Field(default=None, index=True)
    prompt_level: Optional[str] = Field(default="medium", index=True)
    policy_version: Optional[str] = Field(default=None, index=True)
    policy_hash: Optional[str] = Field(default=None, index=True)
    required_rule_set_id: Optional[int] = Field(default=None, foreign_key="requiredruleset.id", index=True)
    required_rule_hash: Optional[str] = Field(default=None, index=True)
    prompt_hash: Optional[str] = Field(default=None, index=True)
    criteria_hash: Optional[str] = Field(default=None, index=True)
    grading_schema_version: Optional[str] = Field(default=None, index=True)
    project_description_hash: Optional[str] = Field(default=None, index=True)
    final_prompt_snapshot: Optional[str] = None
    evaluation_set_id: Optional[int] = Field(default=None, foreign_key="evaluationset.id", index=True)
    started_at: str = ""
    graded_at: Optional[str] = Field(default=None, index=True)


class GradingCriteriaResult(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("grading_run_id", "criterion_key", name="uq_grading_run_criterion"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    grading_run_id: int = Field(foreign_key="gradingrun.id", index=True)
    criterion_key: str = Field(index=True)
    score: float
    max_score: float
    suggestion: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))


class GradingSlideReview(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("grading_run_id", "slide_number", name="uq_grading_run_slide"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    grading_run_id: int = Field(foreign_key="gradingrun.id", index=True)
    slide_number: int = Field(index=True)
    status: str = Field(default="NG", index=True)
    title: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    summary: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    issues: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    suggestions: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: str = ""


class UploadResponse(BaseModel):
    project_id: str
    project_name: str
    filename: str
    document_type: Optional[str] = None
    document_id: Optional[int] = None
    document_name: Optional[str] = None
    document_version_id: Optional[int] = None
    document_version: Optional[str] = None
    message: str
    project_description: Optional[str] = None
    language: LanguageCode = "ja"


class SlideReviewOut(BaseModel):
    id: int
    slide_number: int
    status: Literal["OK", "NG"]
    title: Optional[Dict[str, Any]] = None
    summary: Optional[Dict[str, Any]] = None
    issues: Optional[Dict[str, Any]] = None
    suggestions: Optional[Dict[str, Any]] = None


class GradeResponse(BaseModel):
    project_id: str
    project_name: str
    score: Optional[int] = None
    run_id: Optional[int] = None
    status: str = "PENDING"
    document_version_id: Optional[int] = None
    document_version: Optional[str] = None
    rubric_version: Optional[str] = None
    rubric_hash: Optional[str] = None
    gemini_model: Optional[str] = None
    prompt_version: Optional[str] = None
    prompt_level: Optional[str] = None
    evaluation_set_id: Optional[int] = None
    policy_version: Optional[str] = None
    policy_hash: Optional[str] = None
    required_rule_hash: Optional[str] = None
    prompt_hash: Optional[str] = None
    criteria_hash: Optional[str] = None
    grading_schema_version: Optional[str] = None
    criteria_scores: Optional[Dict[str, float]] = None
    criteria_suggestions: Optional[Dict[str, Any]] = None
    draft_feedback: Optional[Dict[str, Any]] = None
    slide_reviews: list[SlideReviewOut] = []
    graded_at: Optional[str] = None
    language: LanguageCode = "ja"


class GradeAllResult(BaseModel):
    project_id: str
    project_name: str
    score: Optional[int] = None
    run_id: Optional[int] = None
    document_version_id: Optional[int] = None
    document_version: Optional[str] = None
    rubric_version: Optional[str] = None
    rubric_hash: Optional[str] = None
    gemini_model: Optional[str] = None
    prompt_version: Optional[str] = None
    prompt_level: Optional[str] = None
    policy_version: Optional[str] = None
    policy_hash: Optional[str] = None
    required_rule_hash: Optional[str] = None
    prompt_hash: Optional[str] = None
    criteria_hash: Optional[str] = None
    grading_schema_version: Optional[str] = None
    criteria_scores: Optional[Dict[str, float]] = None
    criteria_suggestions: Optional[Dict[str, Any]] = None
    success: bool
    error: Optional[str] = None


class GradeAllResponse(BaseModel):
    graded_count: int
    failed_count: int
    results: list[GradeAllResult]


GradeJobStatus = Literal["queued", "running", "completed", "failed"]


class GradeJobResponse(BaseModel):
    job_id: str
    status: GradeJobStatus
    total_count: int
    processed_count: int
    graded_count: int
    failed_count: int
    results: list[GradeAllResult]
    started_at: str
    finished_at: Optional[str] = None
    error: Optional[str] = None


class CriteriaResultOut(BaseModel):
    key: str
    score: float
    max_score: float
    suggestion: Optional[Dict[str, Any]] = None


class GradingRunOut(BaseModel):
    id: int
    score: Optional[int] = None
    total_score: Optional[int] = None
    document_version_id: Optional[int] = None
    document_version: Optional[str] = None
    rubric_version: Optional[str] = None
    rubric_hash: Optional[str] = None
    gemini_model: Optional[str] = None
    prompt_version: Optional[str] = None
    prompt_level: Optional[str] = None
    evaluation_set_id: Optional[int] = None
    policy_version: Optional[str] = None
    policy_hash: Optional[str] = None
    required_rule_hash: Optional[str] = None
    prompt_hash: Optional[str] = None
    criteria_hash: Optional[str] = None
    grading_schema_version: Optional[str] = None
    final_prompt_snapshot: Optional[str] = None
    criteria_results: list[CriteriaResultOut] = []
    slide_reviews: list[SlideReviewOut] = []
    issue_breakdown: Dict[str, int] = {}
    draft_feedback: Optional[Dict[str, Any]] = None
    status: str
    error_message: Optional[str] = None
    graded_at: Optional[str] = None


class GradingRunHistoryOut(BaseModel):
    id: int
    score: Optional[int] = None
    total_score: Optional[int] = None
    document_id: Optional[int] = None
    document_type: Optional[str] = None
    document_name: Optional[str] = None
    document_version_id: Optional[int] = None
    document_version: Optional[str] = None
    rubric_version: Optional[str] = None
    rubric_hash: Optional[str] = None
    gemini_model: Optional[str] = None
    prompt_version: Optional[str] = None
    prompt_level: Optional[str] = None
    policy_version: Optional[str] = None
    policy_hash: Optional[str] = None
    required_rule_hash: Optional[str] = None
    prompt_hash: Optional[str] = None
    criteria_hash: Optional[str] = None
    grading_schema_version: Optional[str] = None
    final_prompt_snapshot: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    graded_at: Optional[str] = None
    criteria_result_count: int = 0
    slide_review_count: int = 0
    ng_slide_count: int = 0
    issue_count: int = 0


class ProjectOut(BaseModel):
    project_id: str
    project_name: str
    total_documents: int
    latest_updated_at: str
    latest_score: Optional[int] = None
    latest_status: str = "pending"
    latest_error_message: Optional[str] = None
    project_description: Optional[str] = None


class SubmissionOut(BaseModel):
    project_id: str
    project_name: str
    filename: str
    document_type: Optional[str] = None
    uploaded_at: str
    language: LanguageCode = "ja"
    status: str = "uploaded"
    project_description: Optional[str] = None
    latest_document_version_id: Optional[int] = None
    latest_document_version: Optional[str] = None
    latest_document_id: Optional[int] = None
    latest_document_name: Optional[str] = None
    latest_score: Optional[int] = None
    latest_prompt_level: Optional[str] = None
    latest_graded_at: Optional[str] = None
    latest_run: Optional[GradingRunOut] = None
    run_history: list[GradingRunHistoryOut] = []


class DocumentOut(BaseModel):
    id: int
    submission_id: int
    document_type: str
    document_name: str
    created_at: str
    updated_at: str
    is_latest: bool


class DocumentListOut(BaseModel):
    document_id: int
    document_type: str
    document_name: str
    latest_version: Optional[str] = None
    latest_uploaded_at: Optional[str] = None
    latest_score: Optional[int] = None
    latest_status: str = "pending"
    latest_error_message: Optional[str] = None


class DocumentVersionOut(BaseModel):
    id: int
    submission_id: int
    document_id: Optional[int] = None
    document_type: Optional[str] = None
    document_name: Optional[str] = None
    document_version: str
    filename: str
    original_filename: str
    file_path: Optional[str] = None
    content_hash: str
    language: LanguageCode = "ja"
    uploaded_at: str
    is_latest: bool


class VersionListOut(BaseModel):
    document_version_id: int
    version: str
    filename: str
    uploaded_at: str
    is_latest: bool
    content_hash: str
    latest_grading_score: Optional[int] = None
    latest_status: str = "pending"
    latest_error_message: Optional[str] = None


class GradingRunDetailOut(BaseModel):
    submission: SubmissionOut
    document: Optional[DocumentOut] = None
    document_version: Optional[DocumentVersionOut] = None
    grading_run: GradingRunOut
    rubric: Optional["RubricVersionOut"] = None
    criteria_results: list[CriteriaResultOut] = []
    slide_reviews: list[SlideReviewOut] = []


class CriteriaDeltaOut(BaseModel):
    key: str
    base_score: Optional[float] = None
    compare_score: Optional[float] = None
    delta: float = 0.0
    status: Literal["improved", "regressed", "unchanged", "new", "retired"]

class VersionComparisonOut(BaseModel):
    document: DocumentOut
    base_version: DocumentVersionOut
    compare_version: DocumentVersionOut
    base_run: Optional[GradingRunOut] = None
    compare_run: Optional[GradingRunOut] = None
    score_delta: Optional[int] = None
    criteria_deltas: list[CriteriaDeltaOut] = []
    ok_slide_delta: int = 0
    ng_slide_delta: int = 0
    insights: list[str] = []


class SubmissionListResponse(BaseModel):
    submissions: list[SubmissionOut]
    total: int
    ungraded_count: int


class RubricCriterion(BaseModel):
    key: str
    max_score: float
    labels: Dict[LanguageCode, str]


class RubricVersionPayload(BaseModel):
    version: str
    criteria: list[RubricCriterion]
    prompt: Dict[LanguageCode, str]



class RubricVersionOut(RubricVersionPayload):
    document_type: str
    active: bool = False


class RubricListResponse(BaseModel):
    rubrics: list[RubricVersionOut]


class GradingListOut(BaseModel):
    grading_run_id: int
    total_score: Optional[int] = None
    status: str = "completed"
    error_message: Optional[str] = None
    prompt_level: Optional[str] = None
    rubric_version: Optional[str] = None
    prompt_version: Optional[str] = None
    gemini_model: Optional[str] = None
    created_at: str


class GradeRequest(BaseModel):
    document_version_id: int
    prompt_level: PromptLevel = "medium"
    rubric_version: Optional[str] = None
    evaluation_set_id: Optional[int] = None
    force: bool = False


class ProjectCreate(BaseModel):
    project_id: str
    project_name: str
    project_description: Optional[str] = None


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    project_description: Optional[str] = None
