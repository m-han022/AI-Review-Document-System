from datetime import datetime
import hashlib

from sqlmodel import Session, select

from app.database import engine
from app.models import (
    EvaluationPolicy,
    EvaluationSet,
    GradingRun,
    PromptVersion,
    RequiredRuleSet,
    Rubric,
    Submission,
    SubmissionDocument,
    SubmissionDocumentVersion,
)


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def h(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def ensure_project(session: Session, project_id: str, name: str, desc: str, lang: str = "vi") -> Submission:
    p = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
    if p:
        return p
    p = Submission(
        project_id=project_id,
        project_name=name,
        project_description=desc,
        filename=f"{project_id}_seed.pdf",
        document_type="project-review",
        language=lang,
        uploaded_at=now_iso(),
        status="uploaded",
    )
    session.add(p)
    session.flush()
    return p


def ensure_doc(session: Session, sub_id: int, doc_type: str, doc_name: str) -> SubmissionDocument:
    d = session.exec(
        select(SubmissionDocument).where(
            SubmissionDocument.submission_id == sub_id,
            SubmissionDocument.document_type == doc_type,
            SubmissionDocument.document_name == doc_name,
        )
    ).first()
    if d:
        return d
    d = SubmissionDocument(
        submission_id=sub_id,
        document_type=doc_type,
        document_name=doc_name,
        created_at=now_iso(),
        updated_at=now_iso(),
        is_latest=True,
    )
    session.add(d)
    session.flush()
    return d


def ensure_ver(session: Session, sub_id: int, doc: SubmissionDocument, ver: str, filename: str, text: str, lang: str) -> SubmissionDocumentVersion:
    v = session.exec(
        select(SubmissionDocumentVersion).where(
            SubmissionDocumentVersion.document_id == doc.id,
            SubmissionDocumentVersion.document_version == ver,
        )
    ).first()
    if v:
        return v
    v = SubmissionDocumentVersion(
        submission_id=sub_id,
        document_id=doc.id,
        document_version=ver,
        filename=filename,
        original_filename=filename,
        file_path=f"uploads/{filename}",
        extracted_text=text,
        content_hash=h(text),
        language=lang,
        uploaded_at=now_iso(),
        is_latest=True,
    )
    session.add(v)
    session.flush()
    return v


def active_set(session: Session, doc_type: str, level: str = "medium") -> EvaluationSet | None:
    return session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == doc_type,
            EvaluationSet.level == level,
            EvaluationSet.status == "active",
        )
    ).first()


def ensure_set_if_missing(session: Session, doc_type: str, level: str = "medium") -> EvaluationSet | None:
    s = active_set(session, doc_type, level)
    if s:
        return s
    rb = session.exec(select(Rubric).where(Rubric.document_type == doc_type, Rubric.status == "active")).first()
    pp = session.exec(select(PromptVersion).where(PromptVersion.document_type == doc_type, PromptVersion.level == level, PromptVersion.status == "active")).first()
    pol = session.exec(select(EvaluationPolicy).where(EvaluationPolicy.level == level, EvaluationPolicy.status == "active")).first()
    rr = session.exec(select(RequiredRuleSet).where(RequiredRuleSet.status == "active")).first()
    if not (rb and pp and pol and rr):
        return None
    s = EvaluationSet(
        name=f"{doc_type}-{level}-stress-seed",
        document_type=doc_type,
        level=level,
        rubric_version_id=rb.id or 0,
        prompt_version_id=pp.id or 0,
        policy_version_id=pol.id or 0,
        required_rule_set_id=rr.id,
        required_rules_version=rr.version,
        required_rule_hash=rr.hash,
        status="active",
        version_label=f"{doc_type}-{level}-stress",
        created_at=now_iso(),
    )
    session.add(s)
    session.flush()
    return s


def add_run(
    session: Session,
    sub: Submission,
    ver: SubmissionDocumentVersion,
    set_id: int | None,
    status: str,
    score: int | None,
    err: str | None = None,
) -> None:
    exists = session.exec(
        select(GradingRun).where(
            GradingRun.submission_id == (sub.id or 0),
            GradingRun.document_version_id == ver.id,
            GradingRun.status == status,
        )
    ).first()
    if exists:
        return
    run = GradingRun(
        submission_id=sub.id or 0,
        document_version_id=ver.id,
        document_version=ver.document_version,
        status=status,
        score=score,
        total_score=score,
        content_hash=ver.content_hash,
        prompt_level="medium",
        evaluation_set_id=set_id,
        error_message=err,
        started_at=now_iso(),
        graded_at=(now_iso() if status in {"COMPLETED", "FAILED"} else None),
    )
    session.add(run)


def main() -> None:
    with Session(engine) as session:
        # Stress: many docs/versions
        doc_types = ["project-review", "bug-analysis", "qa-review", "explanation-review"]
        created_projects = 0
        for i in range(1, 16):
            pid = f"P3{i:03d}"
            sub = ensure_project(session, pid, f"Stress Project {i}", f"Stress dataset project {i}", "vi")
            if sub.project_name == f"Stress Project {i}":
                created_projects += 1
            for dt in doc_types:
                s = ensure_set_if_missing(session, dt, "medium")
                d = ensure_doc(session, sub.id or 0, dt, f"{dt.replace('-', '_')}_{i:02d}")
                v1 = ensure_ver(session, sub.id or 0, d, "v1", f"{pid}_{dt}_v1.pdf", f"{pid} {dt} v1 content", "vi")
                v2 = ensure_ver(session, sub.id or 0, d, "v2", f"{pid}_{dt}_v2.pdf", f"{pid} {dt} v2 content improved", "vi")
                add_run(session, sub, v1, s.id if s else None, "COMPLETED", 65 + (i % 20))
                add_run(session, sub, v2, s.id if s else None, "COMPLETED", 70 + (i % 20))

        # Japanese realistic cases
        jp = ensure_project(session, "P4001", "日本語レビュー案件", "日本語の振り返り資料レビュー", "ja")
        s_pr = ensure_set_if_missing(session, "project-review", "medium")
        d_jp = ensure_doc(session, jp.id or 0, "project-review", "retrospective_ja")
        v_jp = ensure_ver(session, jp.id or 0, d_jp, "v1", "P4001_project-review_ja_v1.pdf", "進捗、品質、リスク、改善方針を記載。", "ja")
        add_run(session, jp, v_jp, s_pr.id if s_pr else None, "COMPLETED", 84)

        # Edge cases: pending/fail + run without evaluation_set_id (legacy-like)
        edge = ensure_project(session, "P4999", "Edge Cases Project", "Dataset for edge-case behavior", "vi")
        s_bug = ensure_set_if_missing(session, "bug-analysis", "medium")
        d_edge = ensure_doc(session, edge.id or 0, "bug-analysis", "edge_timeout_case")
        v_edge = ensure_ver(session, edge.id or 0, d_edge, "v1", "P4999_bug-analysis_edge_v1.pdf", "Edge timeout analysis", "vi")
        add_run(session, edge, v_edge, s_bug.id if s_bug else None, "FAILED", None, "Gemini timeout (seed edge case)")
        add_run(session, edge, v_edge, s_bug.id if s_bug else None, "PENDING", None, None)
        add_run(session, edge, v_edge, None, "COMPLETED", 73)  # legacy-like: no evaluation_set_id

        session.commit()
        print("Stress + edge dataset seeded.")
        print("Added/ensured stress projects: P3001..P3015, JP: P4001, EDGE: P4999")


if __name__ == "__main__":
    main()

