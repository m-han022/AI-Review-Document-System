import hashlib
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
    Submission,
    SubmissionDocument,
    SubmissionDocumentVersion,
)


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def h(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def get_active_ruleset(session: Session) -> RequiredRuleSet:
    row = session.exec(select(RequiredRuleSet).where(RequiredRuleSet.status == "active")).first()
    if not row:
        raise RuntimeError("Missing active required rule set. Please initialize DB first.")
    return row


def get_active_rubric(session: Session, document_type: str) -> Rubric:
    row = session.exec(
        select(Rubric).where(Rubric.document_type == document_type, Rubric.status == "active")
    ).first()
    if not row:
        raise RuntimeError(f"Missing active rubric for {document_type}")
    return row


def get_active_prompt(session: Session, document_type: str, level: str) -> PromptVersion:
    row = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == document_type,
            PromptVersion.level == level,
            PromptVersion.status == "active",
        )
    ).first()
    if row:
        return row
    row = PromptVersion(
        document_type=document_type,
        level=level,
        version="v1",
        content=f"Seed prompt for {document_type}/{level}.",
        status="active",
        created_at=now_iso(),
    )
    session.add(row)
    session.flush()
    return row


def get_active_policy(session: Session, level: str) -> EvaluationPolicy:
    row = session.exec(
        select(EvaluationPolicy).where(EvaluationPolicy.level == level, EvaluationPolicy.status == "active")
    ).first()
    if row:
        return row
    row = EvaluationPolicy(
        level=level,
        version="v1",
        content=(
            "- Không có số liệu -> không chấm tối đa.\n"
            "- Không có root cause -> tối đa 2/5 mục liên quan.\n"
            "- Thiếu owner/KPI/control point/SLA -> trừ điểm."
        ),
        status="active",
        created_at=now_iso(),
    )
    session.add(row)
    session.flush()
    return row


def get_or_create_eval_set(
    session: Session,
    document_type: str,
    level: str,
    ruleset: RequiredRuleSet,
) -> EvaluationSet:
    row = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == level,
            EvaluationSet.status == "active",
        )
    ).first()
    if row:
        return row

    rubric = get_active_rubric(session, document_type)
    prompt = get_active_prompt(session, document_type, level)
    policy = get_active_policy(session, level)
    row = EvaluationSet(
        name=f"{document_type}-{level}-seed-scenarios",
        document_type=document_type,
        level=level,
        rubric_version_id=rubric.id or 0,
        prompt_version_id=prompt.id or 0,
        policy_version_id=policy.id or 0,
        required_rule_set_id=ruleset.id,
        required_rules_version=ruleset.version,
        required_rule_hash=ruleset.hash,
        version_label=f"{document_type}-{level}-seed",
        status="active",
        created_at=now_iso(),
    )
    session.add(row)
    session.flush()
    return row


def get_or_create_project(session: Session, project_id: str, name: str, desc: str) -> Submission:
    row = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
    if row:
        return row
    row = Submission(
        project_id=project_id,
        project_name=name,
        project_description=desc,
        filename=f"{project_id}_placeholder.pdf",
        document_type="project-review",
        language="vi",
        file_path=None,
        uploaded_at=now_iso(),
        status="uploaded",
    )
    session.add(row)
    session.flush()
    return row


def get_or_create_doc(session: Session, sub_id: int, document_type: str, document_name: str) -> SubmissionDocument:
    row = session.exec(
        select(SubmissionDocument).where(
            SubmissionDocument.submission_id == sub_id,
            SubmissionDocument.document_type == document_type,
            SubmissionDocument.document_name == document_name,
        )
    ).first()
    if row:
        return row
    row = SubmissionDocument(
        submission_id=sub_id,
        document_type=document_type,
        document_name=document_name,
        created_at=now_iso(),
        updated_at=now_iso(),
        is_latest=True,
    )
    session.add(row)
    session.flush()
    return row


def get_or_create_ver(
    session: Session,
    sub_id: int,
    doc: SubmissionDocument,
    ver: str,
    filename: str,
    text: str,
) -> SubmissionDocumentVersion:
    row = session.exec(
        select(SubmissionDocumentVersion).where(
            SubmissionDocumentVersion.document_id == doc.id,
            SubmissionDocumentVersion.document_version == ver,
        )
    ).first()
    if row:
        return row
    row = SubmissionDocumentVersion(
        submission_id=sub_id,
        document_id=doc.id,
        document_version=ver,
        filename=filename,
        original_filename=filename,
        file_path=f"uploads/{filename}",
        extracted_text=text,
        content_hash=h(text),
        language="vi",
        uploaded_at=now_iso(),
        is_latest=True,
    )
    session.add(row)
    session.flush()
    return row


def run_exists(session: Session, sub_id: int, ver_id: int, status: str) -> bool:
    row = session.exec(
        select(GradingRun).where(
            GradingRun.submission_id == sub_id,
            GradingRun.document_version_id == ver_id,
            GradingRun.status == status,
        )
    ).first()
    return row is not None


def add_run(
    session: Session,
    submission: Submission,
    version: SubmissionDocumentVersion,
    eval_set: EvaluationSet,
    rubric: Rubric,
    prompt: PromptVersion,
    policy: EvaluationPolicy,
    ruleset: RequiredRuleSet,
    status: str,
    score: int | None,
) -> None:
    if run_exists(session, submission.id or 0, version.id or 0, status):
        return

    run = GradingRun(
        submission_id=submission.id or 0,
        document_version_id=version.id,
        document_version=version.document_version,
        rubric_id=rubric.id,
        rubric_version=rubric.version,
        rubric_hash=h(str(rubric.prompt)),
        gemini_model="seed-mock-model",
        score=score,
        total_score=score,
        draft_feedback={"vi": "Seed feedback", "ja": ""},
        status=status,
        error_message=("Gemini timeout for scenario test" if status == "FAILED" else None),
        content_hash=version.content_hash,
        prompt_version=prompt.version,
        prompt_level=eval_set.level,
        policy_version=policy.version,
        policy_hash=h(policy.content),
        required_rule_set_id=ruleset.id,
        required_rule_hash=ruleset.hash,
        prompt_hash=h(prompt.content),
        criteria_hash=h("review_tong_the|diem_tot|diem_xau|chinh_sach"),
        grading_schema_version="v1_slide_reviews",
        project_description_hash=h(submission.project_description or ""),
        final_prompt_snapshot="seed snapshot",
        evaluation_set_id=eval_set.id,
        started_at=now_iso(),
        graded_at=(now_iso() if status in {"COMPLETED", "FAILED"} else None),
    )
    session.add(run)
    session.flush()

    if status != "COMPLETED" or score is None:
        return

    criteria = {
        "review_tong_the": min(25.0, round(score * 0.25, 1)),
        "diem_tot": min(25.0, round(score * 0.25, 1)),
        "diem_xau": min(30.0, round(score * 0.30, 1)),
        "chinh_sach": min(20.0, round(score * 0.20, 1)),
    }
    max_scores = {"review_tong_the": 25, "diem_tot": 25, "diem_xau": 30, "chinh_sach": 20}
    for key, value in criteria.items():
        session.add(
            GradingCriteriaResult(
                grading_run_id=run.id or 0,
                criterion_key=key,
                score=value,
                max_score=max_scores[key],
                suggestion={"vi": {"vi": f"{key}: seed suggestion"}, "ja": ""},
            )
        )

    session.add(
        GradingSlideReview(
            grading_run_id=run.id or 0,
            slide_number=1,
            status="OK",
            title={"vi": "Tổng quan", "ja": ""},
            summary={"vi": "Đạt mục tiêu.", "ja": ""},
            issues={"vi": [], "ja": []},
            suggestions={"vi": "Duy trì.", "ja": ""},
            created_at=now_iso(),
        )
    )
    session.add(
        GradingSlideReview(
            grading_run_id=run.id or 0,
            slide_number=2,
            status="NG",
            title={"vi": "Thiếu định lượng", "ja": ""},
            summary={"vi": "Thiếu KPI theo tuần.", "ja": ""},
            issues={"vi": ["Thiếu KPI"], "ja": []},
            suggestions={"vi": "Bổ sung KPI + owner.", "ja": ""},
            created_at=now_iso(),
        )
    )


def main() -> None:
    with Session(engine) as session:
        ruleset = get_active_ruleset(session)

        scenarios = [
            {
                "project_id": "P2001",
                "name": "Chuẩn hóa retrospective team A",
                "desc": "Team A chuẩn hóa báo cáo theo KPI sprint.",
                "items": [
                    ("project-review", "retro_sprint_10", [("v1", 72, "COMPLETED"), ("v2", 88, "COMPLETED")]),
                    ("qa-review", "qa_release_r1", [("v1", 81, "COMPLETED")]),
                ],
            },
            {
                "project_id": "P2002",
                "name": "Giảm lỗi payment timeout",
                "desc": "Theo dõi root cause và biện pháp ngăn tái phát.",
                "items": [
                    ("bug-analysis", "payment_timeout_rca", [("v1", 76, "COMPLETED"), ("v2", None, "FAILED")]),
                    ("project-review", "monthly_review_apr", [("v1", None, "PENDING")]),
                ],
            },
            {
                "project_id": "P2003",
                "name": "Tối ưu tài liệu hướng dẫn nội bộ",
                "desc": "Nâng chất lượng tài liệu giải thích cho onboarding.",
                "items": [
                    ("explanation-review", "onboarding_api_guide", [("v1", 83, "COMPLETED"), ("v2", 79, "COMPLETED")]),
                ],
            },
        ]

        created_runs = 0
        for sc in scenarios:
            sub = get_or_create_project(session, sc["project_id"], sc["name"], sc["desc"])
            for doc_type, doc_name, versions in sc["items"]:
                eval_set = get_or_create_eval_set(session, doc_type, "medium", ruleset)
                rubric = session.get(Rubric, eval_set.rubric_version_id)
                prompt = session.get(PromptVersion, eval_set.prompt_version_id)
                policy = session.get(EvaluationPolicy, eval_set.policy_version_id)
                if not rubric or not prompt or not policy:
                    continue
                doc = get_or_create_doc(session, sub.id or 0, doc_type, doc_name)
                for ver, score, status in versions:
                    filename = f"{sc['project_id']}_{doc_type}_{doc_name}_{ver}.pdf"
                    text = f"Seed content {sc['project_id']} {doc_type} {doc_name} {ver}"
                    v = get_or_create_ver(session, sub.id or 0, doc, ver, filename, text)
                    before = run_exists(session, sub.id or 0, v.id or 0, status)
                    add_run(session, sub, v, eval_set, rubric, prompt, policy, ruleset, status, score)
                    after = run_exists(session, sub.id or 0, v.id or 0, status)
                    if (not before) and after:
                        created_runs += 1

        session.commit()

        print("Seed scenario dataset completed.")
        print("Projects added/ensured: P2001, P2002, P2003")
        print(f"New runs created: {created_runs}")


if __name__ == "__main__":
    main()
