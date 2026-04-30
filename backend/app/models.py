from pydantic import BaseModel
from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, Literal, Dict, Any

# Supported languages
LanguageCode = Literal["vi", "ja"]
RubricStatus = Literal["draft", "active", "archived"]


class Submission(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: str = Field(index=True, unique=True)
    project_name: str
    filename: str
    document_type: str = Field(default="project-review", index=True)
    language: str = Field(default="ja", index=True)
    file_path: Optional[str] = None
    uploaded_at: str = ""
    status: str = Field(default="uploaded", index=True)
    latest_grading_run_id: Optional[int] = Field(default=None, foreign_key="gradingrun.id")


class SubmissionContent(SQLModel, table=True):
    submission_id: int = Field(primary_key=True, foreign_key="submission.id")
    extracted_text: str
    content_hash: str = Field(index=True)


class Rubric(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("document_type", "version", name="uq_rubric_document_type_version"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    document_type: str = Field(index=True)
    version: str = Field(index=True)
    active: bool = Field(default=False, index=True)
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


class GradingRun(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    submission_id: int = Field(foreign_key="submission.id", index=True)
    rubric_id: Optional[int] = Field(default=None, foreign_key="rubric.id", index=True)
    rubric_version: Optional[str] = None
    gemini_model: Optional[str] = None
    score: Optional[int] = Field(default=None, index=True)
    draft_feedback: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    status: str = Field(default="completed", index=True)
    error_message: Optional[str] = None
    content_hash: str = Field(index=True)
    prompt_hash: Optional[str] = Field(default=None, index=True)
    criteria_hash: Optional[str] = Field(default=None, index=True)
    grading_schema_version: Optional[str] = Field(default=None, index=True)
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
    message: str
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
    score: int
    run_id: int
    rubric_version: Optional[str] = None
    gemini_model: Optional[str] = None
    prompt_hash: Optional[str] = None
    criteria_hash: Optional[str] = None
    grading_schema_version: Optional[str] = None
    criteria_scores: Optional[Dict[str, float]] = None
    criteria_suggestions: Optional[Dict[str, Any]] = None
    draft_feedback: Optional[Dict[str, Any]] = None
    slide_reviews: list[SlideReviewOut] = []
    graded_at: str
    language: LanguageCode = "ja"


class GradeAllResult(BaseModel):
    project_id: str
    project_name: str
    score: Optional[int] = None
    run_id: Optional[int] = None
    rubric_version: Optional[str] = None
    gemini_model: Optional[str] = None
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
    rubric_version: Optional[str] = None
    gemini_model: Optional[str] = None
    prompt_hash: Optional[str] = None
    criteria_hash: Optional[str] = None
    grading_schema_version: Optional[str] = None
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
    rubric_version: Optional[str] = None
    gemini_model: Optional[str] = None
    prompt_hash: Optional[str] = None
    criteria_hash: Optional[str] = None
    grading_schema_version: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    graded_at: Optional[str] = None
    criteria_result_count: int = 0
    slide_review_count: int = 0
    ng_slide_count: int = 0
    issue_count: int = 0


class SubmissionOut(BaseModel):
    project_id: str
    project_name: str
    filename: str
    document_type: Optional[str] = None
    uploaded_at: str
    language: LanguageCode = "ja"
    status: str = "uploaded"
    latest_run: Optional[GradingRunOut] = None
    run_history: list[GradingRunHistoryOut] = []


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
