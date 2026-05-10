from sqlmodel import Session, select
from app.database import engine
from app.models import Submission, GradingRun
import json

def check_project_run(project_id_pattern, target_time):
    with Session(engine) as session:
        # Find submission
        submission = session.exec(select(Submission).where(Submission.project_id.like(f"%{project_id_pattern}%"))).first()
        if not submission:
            print(f"Project matching '{project_id_pattern}' not found.")
            return

        print(f"Found Project: {submission.project_name} (ID: {submission.project_id}, DB ID: {submission.id})")
        
        # Find grading runs
        runs = session.exec(
            select(GradingRun)
            .where(GradingRun.submission_id == submission.id)
            .order_by(GradingRun.id.desc())
        ).all()
        
        print("\nGrading Runs:")
        target_run = None
        for run in runs:
            print(f"ID: {run.id}, Status: {run.status}, Time: {run.graded_at}, Score: {run.total_score}")
            if target_time in (run.graded_at or ""):
                target_run = run
        
        if not target_run and runs:
            # If not exact match, pick the one closest to 16:22
            # For simplicity, if target_time is "16:22", just show them all
            pass

        if target_run:
            print(f"\nTarget Run Details (ID: {target_run.id}):")
            print(f"Prompt Level: {target_run.prompt_level}")
            print(f"Score: {target_run.total_score}")
            # Check if it has criteria and slide reviews
            from app.models import GradingCriteriaResult, GradingSlideReview
            criteria = session.exec(select(GradingCriteriaResult).where(GradingCriteriaResult.grading_run_id == target_run.id)).all()
            slides = session.exec(select(GradingSlideReview).where(GradingSlideReview.grading_run_id == target_run.id)).all()
            
            print(f"Criteria Results Count: {len(criteria)}")
            print(f"Slide Reviews Count: {len(slides)}")
            
            # Check for consistency
            if len(criteria) == 0 and target_run.status == "COMPLETED":
                print("WARNING: COMPLETED run has no criteria results!")
            if len(slides) == 0 and target_run.status == "COMPLETED":
                print("WARNING: COMPLETED run has no slide reviews!")

if __name__ == "__main__":
    check_project_run("Project012", "16:22")
