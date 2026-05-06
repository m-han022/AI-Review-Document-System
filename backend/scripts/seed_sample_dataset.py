import hashlib
import json
from datetime import datetime

from sqlmodel import Session, select

from app.database import engine
from app.models import (
    EvaluationPolicy,
    EvaluationSet,
    GradingCriteriaResult,
    GradingRun,
    GradingSlideReview,
    PromptVersion,
    RequiredRuleSet,
    Rubric,
    RubricCriterionRecord,
    Submission,
    SubmissionDocument,
    SubmissionDocumentVersion,
)


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def next_version(existing: list[str]) -> str:
    nums = []
    for item in existing:
        if item and item.lower().startswith("v"):
            try:
                nums.append(int(item[1:]))
            except ValueError:
                pass
    return f"v{(max(nums) if nums else 0) + 1}"


def ensure_active_rubric(session: Session, document_type: str) -> Rubric:
    active = session.exec(
        select(Rubric).where(Rubric.document_type == document_type, Rubric.status == "active")
    ).first()
    if active:
        return active

    versions = session.exec(select(Rubric.version).where(Rubric.document_type == document_type)).all()
    rubric = Rubric(
        document_type=document_type,
        version=next_version(versions),
        active=True,
        status="active",
        prompt={
            "vi": "Rubric mẫu cho bộ dữ liệu seed.",
            "ja": "Seed rubric sample.",
        },
        created_at=now_iso(),
        updated_at=now_iso(),
    )
    session.add(rubric)
    session.flush()

    criteria = [
        ("review_tong_the", 25, "Đánh giá tổng thể", "Overall review"),
        ("diem_tot", 25, "Điểm tốt", "Strengths"),
        ("diem_xau", 30, "Điểm cần cải thiện", "Weak points"),
        ("chinh_sach", 20, "Chính sách cải thiện", "Improvement policy"),
    ]
    for idx, (key, max_score, label_vi, label_ja) in enumerate(criteria, start=1):
        session.add(
            RubricCriterionRecord(
                rubric_id=rubric.id or 0,
                key=key,
                max_score=max_score,
                label_vi=label_vi,
                label_ja=label_ja,
                sort_order=idx,
            )
        )
    session.flush()
    return rubric


def ensure_active_prompt(session: Session, document_type: str, level: str) -> PromptVersion:
    active = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == document_type,
            PromptVersion.level == level,
            PromptVersion.status == "active",
        )
    ).first()
    if active:
        return active

    versions = session.exec(
        select(PromptVersion.version).where(
            PromptVersion.document_type == document_type, PromptVersion.level == level
        )
    ).all()
    prompt = PromptVersion(
        document_type=document_type,
        level=level,
        version=next_version(versions),
        content=(
            "【QUAN TRỌNG: PHẢN HỒI BẰNG TIẾNG VIỆT】\n"
            "Đây là prompt mẫu seed để kiểm thử luồng Project -> Document -> Version -> Grading."
        ),
        status="active",
        created_at=now_iso(),
    )
    session.add(prompt)
    session.flush()
    return prompt


def ensure_active_policy(session: Session, level: str) -> EvaluationPolicy:
    active = session.exec(
        select(EvaluationPolicy).where(EvaluationPolicy.level == level, EvaluationPolicy.status == "active")
    ).first()
    if active:
        return active

    versions = session.exec(select(EvaluationPolicy.version).where(EvaluationPolicy.level == level)).all()
    policy = EvaluationPolicy(
        level=level,
        version=next_version(versions),
        content=(
            "- Không có số liệu -> không chấm tối đa.\n"
            "- Không có root cause -> tối đa 2/5 mục liên quan.\n"
            "- Thiếu owner/KPI/control point/SLA -> trừ điểm."
        ),
        status="active",
        created_at=now_iso(),
    )
    session.add(policy)
    session.flush()
    return policy


def ensure_active_required_rules(session: Session) -> RequiredRuleSet:
    active = session.exec(select(RequiredRuleSet).where(RequiredRuleSet.status == "active")).first()
    if active:
        return active

    rules = [
        "JSON only.",
        "No markdown code block.",
        "Must follow output schema.",
        "Language: Vietnamese.",
    ]
    content = json.dumps(rules, ensure_ascii=False)
    rset = RequiredRuleSet(
        version="system-rules-v1",
        hash=sha(content),
        content=content,
        status="active",
        created_at=now_iso(),
    )
    session.add(rset)
    session.flush()
    return rset


def ensure_active_set(
    session: Session,
    document_type: str,
    level: str,
    rubric: Rubric,
    prompt: PromptVersion,
    policy: EvaluationPolicy,
    ruleset: RequiredRuleSet,
) -> EvaluationSet:
    active = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == level,
            EvaluationSet.status == "active",
        )
    ).first()
    if active:
        return active

    name = f"{document_type}-{level}-v1-seed"
    eset = EvaluationSet(
        name=name,
        document_type=document_type,
        level=level,
        rubric_version_id=rubric.id or 0,
        prompt_version_id=prompt.id or 0,
        policy_version_id=policy.id or 0,
        required_rule_set_id=ruleset.id,
        required_rules_version=ruleset.version,
        required_rule_hash=ruleset.hash,
        version_label=f"{document_type}-{level}-set-v1",
        status="active",
        created_at=now_iso(),
    )
    session.add(eset)
    session.flush()
    return eset


def ensure_project(session: Session) -> Submission:
    project_id = "P1001"
    project = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
    if project:
        return project
    project = Submission(
        project_id=project_id,
        project_name="Nâng cấp quy trình review nội bộ",
        project_description="Dự án cải thiện chất lượng báo cáo retrospective và giảm lỗi tái phát.",
        filename="seed_placeholder.pdf",
        document_type="project-review",
        language="vi",
        file_path=None,
        uploaded_at=now_iso(),
        status="uploaded",
    )
    session.add(project)
    session.flush()
    return project


def ensure_document(session: Session, submission_id: int, document_type: str, document_name: str) -> SubmissionDocument:
    doc = session.exec(
        select(SubmissionDocument).where(
            SubmissionDocument.submission_id == submission_id,
            SubmissionDocument.document_type == document_type,
            SubmissionDocument.document_name == document_name,
        )
    ).first()
    if doc:
        return doc
    doc = SubmissionDocument(
        submission_id=submission_id,
        document_type=document_type,
        document_name=document_name,
        created_at=now_iso(),
        updated_at=now_iso(),
        is_latest=True,
    )
    session.add(doc)
    session.flush()
    return doc


def ensure_version(
    session: Session,
    submission_id: int,
    document: SubmissionDocument,
    version: str,
    filename: str,
    content_hash: str,
    text: str,
) -> SubmissionDocumentVersion:
    row = session.exec(
        select(SubmissionDocumentVersion).where(
            SubmissionDocumentVersion.document_id == document.id,
            SubmissionDocumentVersion.document_version == version,
        )
    ).first()
    if row:
        return row

    row = SubmissionDocumentVersion(
        submission_id=submission_id,
        document_id=document.id,
        document_version=version,
        filename=filename,
        original_filename=filename,
        file_path=f"uploads/{filename}",
        extracted_text=text,
        content_hash=content_hash,
        language="vi",
        uploaded_at=now_iso(),
        is_latest=True,
    )
    session.add(row)
    session.flush()
    return row


def ensure_grading_run(
    session: Session,
    submission: Submission,
    version: SubmissionDocumentVersion,
    eval_set: EvaluationSet,
    rubric: Rubric,
    prompt: PromptVersion,
    policy: EvaluationPolicy,
    ruleset: RequiredRuleSet,
    score: int,
    criteria: dict[str, float],
) -> GradingRun:
    existing = session.exec(
        select(GradingRun).where(
            GradingRun.submission_id == submission.id,
            GradingRun.document_version_id == version.id,
            GradingRun.evaluation_set_id == eval_set.id,
            GradingRun.status == "COMPLETED",
        )
    ).first()
    if existing:
        return existing

    run = GradingRun(
        submission_id=submission.id or 0,
        document_version_id=version.id,
        document_version=version.document_version,
        rubric_id=rubric.id,
        rubric_version=rubric.version,
        rubric_hash=sha(json.dumps(rubric.prompt, ensure_ascii=False)),
        gemini_model="seed-mock-model",
        score=score,
        total_score=score,
        draft_feedback={
            "vi": "① Tài liệu có cấu trúc tốt. ② Có điểm cần bổ sung định lượng. ③ Cần rõ owner/KPI hơn.",
            "ja": "",
        },
        status="COMPLETED",
        content_hash=version.content_hash,
        prompt_version=prompt.version,
        prompt_level=eval_set.level,
        policy_version=policy.version,
        policy_hash=sha(policy.content),
        required_rule_set_id=ruleset.id,
        required_rule_hash=ruleset.hash,
        prompt_hash=sha(prompt.content),
        criteria_hash=sha(json.dumps(sorted(criteria.keys()))),
        grading_schema_version="v1_slide_reviews",
        project_description_hash=sha(submission.project_description or ""),
        final_prompt_snapshot="seed snapshot",
        evaluation_set_id=eval_set.id,
        started_at=now_iso(),
        graded_at=now_iso(),
    )
    session.add(run)
    session.flush()

    max_scores = {
        "review_tong_the": 25,
        "diem_tot": 25,
        "diem_xau": 30,
        "chinh_sach": 20,
    }
    for key, value in criteria.items():
        session.add(
            GradingCriteriaResult(
                grading_run_id=run.id or 0,
                criterion_key=key,
                score=float(value),
                max_score=float(max_scores.get(key, 25)),
                suggestion={
                    "vi": {
                        "vi": f"Giải thích: {key} đang ở mức {value}. Để tăng điểm: bổ sung số liệu và owner/KPI cụ thể."
                    },
                    "ja": "",
                },
            )
        )

    session.add(
        GradingSlideReview(
            grading_run_id=run.id or 0,
            slide_number=1,
            status="OK",
            title={"vi": "Tổng quan", "ja": ""},
            summary={"vi": "Slide đạt mục tiêu tổng quan.", "ja": ""},
            issues={"vi": [], "ja": []},
            suggestions={"vi": "Duy trì cấu trúc này cho các kỳ sau.", "ja": ""},
            created_at=now_iso(),
        )
    )
    session.add(
        GradingSlideReview(
            grading_run_id=run.id or 0,
            slide_number=2,
            status="NG",
            title={"vi": "Điểm cần cải thiện", "ja": ""},
            summary={"vi": "Thiếu định lượng rõ ràng.", "ja": ""},
            issues={"vi": ["Thiếu KPI định lượng"], "ja": []},
            suggestions={"vi": "Bổ sung KPI theo tuần và owner chịu trách nhiệm.", "ja": ""},
            created_at=now_iso(),
        )
    )
    session.flush()
    return run


def main() -> None:
    with Session(engine) as session:
        submission = ensure_project(session)
        submission_id = submission.id or 0

        ruleset = ensure_active_required_rules(session)

        # Scope 1: project-review / medium
        pr_rubric = ensure_active_rubric(session, "project-review")
        pr_prompt = ensure_active_prompt(session, "project-review", "medium")
        pr_policy = ensure_active_policy(session, "medium")
        pr_set = ensure_active_set(session, "project-review", "medium", pr_rubric, pr_prompt, pr_policy, ruleset)

        # Scope 2: bug-analysis / medium
        bug_rubric = ensure_active_rubric(session, "bug-analysis")
        bug_prompt = ensure_active_prompt(session, "bug-analysis", "medium")
        bug_policy = ensure_active_policy(session, "medium")
        bug_set = ensure_active_set(session, "bug-analysis", "medium", bug_rubric, bug_prompt, bug_policy, ruleset)

        # Documents + versions
        d1 = ensure_document(session, submission_id, "project-review", "retrospective_q1")
        v11 = ensure_version(
            session,
            submission_id,
            d1,
            "v1",
            "P1001_project-review_retrospective_q1_v1.pdf",
            "hash-retro-v1",
            "Nội dung retrospective Q1 - v1",
        )
        v12 = ensure_version(
            session,
            submission_id,
            d1,
            "v2",
            "P1001_project-review_retrospective_q1_v2.pdf",
            "hash-retro-v2",
            "Nội dung retrospective Q1 - v2 có bổ sung KPI",
        )

        d2 = ensure_document(session, submission_id, "bug-analysis", "bug_payment_timeout")
        v21 = ensure_version(
            session,
            submission_id,
            d2,
            "v1",
            "P1001_bug-analysis_bug_payment_timeout_v1.pdf",
            "hash-bug-v1",
            "Nội dung phân tích bug timeout thanh toán",
        )

        # Grading runs
        r1 = ensure_grading_run(
            session,
            submission,
            v11,
            pr_set,
            pr_rubric,
            pr_prompt,
            pr_policy,
            ruleset,
            78,
            {"review_tong_the": 18, "diem_tot": 20, "diem_xau": 24, "chinh_sach": 16},
        )
        r2 = ensure_grading_run(
            session,
            submission,
            v12,
            pr_set,
            pr_rubric,
            pr_prompt,
            pr_policy,
            ruleset,
            86,
            {"review_tong_the": 21, "diem_tot": 22, "diem_xau": 26, "chinh_sach": 17},
        )
        _r3 = ensure_grading_run(
            session,
            submission,
            v21,
            bug_set,
            bug_rubric,
            bug_prompt,
            bug_policy,
            ruleset,
            81,
            {"review_tong_the": 19, "diem_tot": 21, "diem_xau": 25, "chinh_sach": 16},
        )

        # Keep legacy/project pointers updated to latest doc/version/run
        submission.filename = v12.filename
        submission.document_type = d1.document_type
        submission.language = v12.language
        submission.file_path = v12.file_path
        submission.uploaded_at = v12.uploaded_at
        submission.latest_grading_run_id = r2.id

        session.add(submission)
        session.commit()

        print("Seed sample dataset completed.")
        print("Project: P1001")
        print("Documents: retrospective_q1 (v1,v2), bug_payment_timeout (v1)")
        print("Grading runs: 3 COMPLETED")


if __name__ == "__main__":
    main()

