import sys
from sqlmodel import Session, select
from app.database import engine
from app.models import PromptVersion

# Set stdout to utf-8
sys.stdout.reconfigure(encoding='utf-8')

with Session(engine) as session:
    prompts = session.exec(select(PromptVersion).where(PromptVersion.document_type == "project-review")).all()
    for p in prompts:
        print(f"ID: {p.id}, Version: {p.version}, Level: {p.level}")
        print("Content:")
        print(p.content)
        print("-" * 40)
