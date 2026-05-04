import os
import sys
from sqlmodel import Session, create_engine, select, SQLModel
from sqlalchemy import text

# Add backend to sys.path
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import (
    Submission,
    SubmissionContent,
    SubmissionDocument,
    SubmissionDocumentVersion,
    Rubric,
    RubricCriterionRecord,
    GradingRun,
    GradingCriteriaResult,
    GradingSlideReview
)
from app.database import DB_PATH

def migrate():
    sqlite_url = f"sqlite:///{DB_PATH}"
    postgres_url = os.getenv("DATABASE_URL")
    
    if not postgres_url or not postgres_url.startswith("postgresql"):
        print("Error: DATABASE_URL must be a postgresql URL")
        return

    sqlite_engine = create_engine(sqlite_url)
    postgres_engine = create_engine(postgres_url)

    # Tables in order to satisfy FKs (mostly)
    # Submission and GradingRun have a cycle. 
    # We'll insert Submission first with latest_grading_run_id=None,
    # then insert GradingRun, then update Submission.
    
    tables = [
        Rubric,
        RubricCriterionRecord,
        Submission,
        SubmissionContent,
        SubmissionDocument,
        SubmissionDocumentVersion,
        GradingRun,
        GradingCriteriaResult,
        GradingSlideReview
    ]

    with Session(sqlite_engine) as sqlite_session:
        with Session(postgres_engine) as postgres_session:
            print("Starting migration...")
            
            # Disable constraints for the migration session if possible
            # postgres_session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
            
            for table in tables:
                print(f"Migrating {table.__tablename__ if hasattr(table, '__tablename__') else table.__name__}...")
                items = sqlite_session.exec(select(table)).all()
                print(f"  Found {len(items)} items")
                
                for item in items:
                    # Create a new instance to avoid session conflicts
                    data = item.dict()
                    
                    # For Submission, initially clear latest_grading_run_id to break cycle
                    if table == Submission:
                        temp_latest = data.get("latest_grading_run_id")
                        data["latest_grading_run_id"] = None
                        new_item = Submission(**data)
                        # Store the temp value to update later
                        setattr(new_item, "_temp_latest", temp_latest)
                    else:
                        new_item = table(**data)
                    
                    postgres_session.add(new_item)
                
                postgres_session.commit()
                print(f"  Done {table.__name__}")

            # Second pass: Restore latest_grading_run_id for Submissions
            print("Restoring Submission.latest_grading_run_id...")
            submissions = postgres_session.exec(select(Submission)).all()
            for sub in submissions:
                if hasattr(sub, "_temp_latest") and getattr(sub, "_temp_latest") is not None:
                    sub.latest_grading_run_id = getattr(sub, "_temp_latest")
                    postgres_session.add(sub)
            
            postgres_session.commit()
            print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
