from copy import deepcopy
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

from app.models import GradeAllResult, GradeJobResponse
from app.services.grading_engine import grade_submission
from app.storage import store


class GradeJobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, dict] = {}
        self._lock = Lock()
        self._max_job_age_seconds = 3600
        self._max_completed_jobs = 50

    def _is_terminal(self, status: str) -> bool:
        return status in {"completed", "failed"}

    def _prune_jobs_locked(self) -> None:
        now = datetime.now(timezone.utc)
        expired_job_ids: list[str] = []
        completed_jobs: list[tuple[str, datetime]] = []

        for job_id, job_data in self._jobs.items():
            if not self._is_terminal(job_data["status"]):
                continue

            finished_at = job_data.get("finished_at")
            if not finished_at:
                continue

            try:
                finished_at_dt = datetime.fromisoformat(finished_at)
            except ValueError:
                expired_job_ids.append(job_id)
                continue

            if (now - finished_at_dt).total_seconds() > self._max_job_age_seconds:
                expired_job_ids.append(job_id)
                continue

            completed_jobs.append((job_id, finished_at_dt))

        for job_id in expired_job_ids:
            self._jobs.pop(job_id, None)

        if len(completed_jobs) > self._max_completed_jobs:
            completed_jobs.sort(key=lambda item: item[1])
            overflow = len(completed_jobs) - self._max_completed_jobs
            for job_id, _ in completed_jobs[:overflow]:
                self._jobs.pop(job_id, None)

    def create_job(
        self,
        project_ids: list[str],
        *,
        force: bool = False,
        rubric_version: str | None = None,
    ) -> GradeJobResponse:
        now = datetime.now(timezone.utc).isoformat()
        job_id = uuid4().hex
        job_data = {
            "job_id": job_id,
            "status": "queued",
            "total_count": len(project_ids),
            "processed_count": 0,
            "graded_count": 0,
            "failed_count": 0,
            "results": [],
            "started_at": now,
            "finished_at": None,
            "error": None,
            "project_ids": project_ids,
            "force": force,
            "rubric_version": rubric_version,
        }
        with self._lock:
            self._prune_jobs_locked()
            self._jobs[job_id] = job_data
        return self.get_job(job_id)

    def get_job(self, job_id: str) -> GradeJobResponse | None:
        with self._lock:
            self._prune_jobs_locked()
            job_data = self._jobs.get(job_id)
            if not job_data:
                return None
            payload = deepcopy(job_data)
        payload.pop("project_ids", None)
        return GradeJobResponse(**payload)

    def _update_job(self, job_id: str, **changes) -> None:
        with self._lock:
            if job_id not in self._jobs:
                return
            self._jobs[job_id].update(changes)

    def start_job(self, job_id: str) -> None:
        self._update_job(job_id, status="running")

    def append_result(self, job_id: str, result: GradeAllResult, success: bool) -> None:
        with self._lock:
            job_data = self._jobs.get(job_id)
            if not job_data:
                return
            job_data["results"].append(result)
            job_data["processed_count"] += 1
            if success:
                job_data["graded_count"] += 1
            else:
                job_data["failed_count"] += 1

    def complete_job(self, job_id: str) -> None:
        with self._lock:
            if job_id not in self._jobs:
                return
            self._jobs[job_id].update(
                status="completed",
                finished_at=datetime.now(timezone.utc).isoformat(),
            )
            self._prune_jobs_locked()

    def fail_job(self, job_id: str, error: str) -> None:
        with self._lock:
            if job_id not in self._jobs:
                return
            self._jobs[job_id].update(
                status="failed",
                error=error,
                finished_at=datetime.now(timezone.utc).isoformat(),
            )
            self._prune_jobs_locked()

    def run_grade_all_job(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if not job:
            return

        self.start_job(job_id)

        try:
            with self._lock:
                project_ids = list(self._jobs[job_id]["project_ids"])
                force = bool(self._jobs[job_id].get("force", False))
                rubric_version = self._jobs[job_id].get("rubric_version")

            for project_id in project_ids:
                submission = store.get(project_id)
                if not submission:
                    self.append_result(
                        job_id,
                        GradeAllResult(
                            project_id=project_id,
                            project_name="Unknown project",
                            success=False,
                            error="Project not found",
                        ),
                        success=False,
                    )
                    continue

                document_language = submission.language
                # [FIX BUG-01] Capture project_name before try block — submission may be
                # reassigned by store.save_grading_result() inside the try, making
                # submission.project_name unreliable in the except handler.
                project_name = submission.project_name

                try:
                    started_at = datetime.now(timezone.utc).isoformat()
                    result = grade_submission(
                        submission.extracted_text,
                        document_language,
                        getattr(submission, "document_type", None),
                        rubric_version=rubric_version,
                        use_cache=not force,
                        refresh_cache=force,
                    )
                    graded_at = datetime.now(timezone.utc).isoformat()
                    submission = store.save_grading_result(
                        project_id,
                        result,
                        started_at=started_at,
                        graded_at=graded_at,
                    )
                    latest_run = submission.latest_run

                    self.append_result(
                        job_id,
                        GradeAllResult(
                            project_id=project_id,
                            project_name=submission.project_name,
                            score=result["score"],
                            run_id=latest_run.id if latest_run else None,
                            rubric_version=latest_run.rubric_version if latest_run else None,
                            gemini_model=latest_run.gemini_model if latest_run else None,
                            prompt_hash=latest_run.prompt_hash if latest_run else None,
                            criteria_hash=latest_run.criteria_hash if latest_run else None,
                            grading_schema_version=latest_run.grading_schema_version if latest_run else None,
                            criteria_scores=result["criteria_scores"],
                            criteria_suggestions=result.get("criteria_suggestions", {}),
                            success=True,
                        ),
                        success=True,
                    )
                except Exception as exc:
                    self.append_result(
                        job_id,
                        GradeAllResult(
                            project_id=project_id,
                            project_name=project_name,  # use pre-captured value
                            success=False,
                            error=str(exc),
                        ),
                        success=False,
                    )

            self.complete_job(job_id)
        except Exception as exc:
            self.fail_job(job_id, str(exc))


grade_job_store = GradeJobStore()
