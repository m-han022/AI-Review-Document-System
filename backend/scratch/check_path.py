from app.rubric import RUBRIC_TEMPLATES_FILE
print(f"Path: {RUBRIC_TEMPLATES_FILE}")
print(f"Exists: {RUBRIC_TEMPLATES_FILE.exists()}")
if RUBRIC_TEMPLATES_FILE.exists():
    import json
    data = json.loads(RUBRIC_TEMPLATES_FILE.read_text(encoding='utf-8'))
    print(f"Keys: {list(data.keys())}")
