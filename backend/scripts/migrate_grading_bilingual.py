"""
Migration script: Chuẩn hóa toàn bộ dữ liệu nhận xét trong các bảng mới
(GradingRun, GradingCriteriaResult, GradingSlideReview) sang định dạng JSON song ngữ.

Bảo đảm tương thích hoàn toàn với kiến trúc Phase 5 và Frontend (getLocalizedText).
"""
import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "review_system.db"


def wrap_bilingual(val, default_lang="vi", is_list=False):
    if val is None:
        return None
    
    # Nếu đã là dict (được query trả về hoặc parse ra)
    if isinstance(val, dict):
        if "vi" in val or "ja" in val:
            return json.dumps(val, ensure_ascii=False)
        return json.dumps({default_lang: val}, ensure_ascii=False)
        
    if isinstance(val, str):
        val_str = val.strip()
        if not val_str:
            return None
        try:
            parsed = json.loads(val_str)
            if isinstance(parsed, dict):
                if "vi" in parsed or "ja" in parsed:
                    return val_str  # Đã là chuỗi JSON song ngữ chuẩn
                return json.dumps({default_lang: parsed}, ensure_ascii=False)
            elif isinstance(parsed, list):
                # Ví dụ issues là một list
                return json.dumps({default_lang: parsed}, ensure_ascii=False)
            else:
                return json.dumps({default_lang: str(parsed)}, ensure_ascii=False)
        except (json.JSONDecodeError, TypeError):
            # Chuỗi văn bản thuần túy (plain text)
            content = [val_str] if is_list else val_str
            return json.dumps({default_lang: content}, ensure_ascii=False)
            
    # Các kiểu khác
    content = [str(val)] if is_list else str(val)
    return json.dumps({default_lang: content}, ensure_ascii=False)


def migrate():
    if not DB_PATH.exists():
        print(f"Database not found at: {DB_PATH}")
        return

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    print("Starting bilingual normalization for Phase 5 Database...")

    # --- 1. Chuẩn hóa bảng gradingrun ---
    try:
        cursor.execute("SELECT id, draft_feedback FROM gradingrun")
        runs = cursor.fetchall()
        updated_runs = 0
        for run_id, feedback in runs:
            if feedback:
                new_fb = wrap_bilingual(feedback, default_lang="vi")
                if new_fb != feedback:
                    cursor.execute("UPDATE gradingrun SET draft_feedback = ? WHERE id = ?", (new_fb, run_id))
                    updated_runs += 1
        print(f" -> Normalized {updated_runs}/{len(runs)} records in 'gradingrun'.")
    except sqlite3.OperationalError as e:
        print(f" Skipped gradingrun: {e}")

    # --- 2. Chuẩn hóa bảng gradingcriteriaresult ---
    try:
        cursor.execute("SELECT id, suggestion FROM gradingcriteriaresult")
        criteria = cursor.fetchall()
        updated_criteria = 0
        for crit_id, suggestion in criteria:
            if suggestion:
                new_sug = wrap_bilingual(suggestion, default_lang="vi")
                if new_sug != suggestion:
                    cursor.execute("UPDATE gradingcriteriaresult SET suggestion = ? WHERE id = ?", (new_sug, crit_id))
                    updated_criteria += 1
        print(f" -> Normalized {updated_criteria}/{len(criteria)} records in 'gradingcriteriaresult'.")
    except sqlite3.OperationalError as e:
        print(f" Skipped gradingcriteriaresult: {e}")

    # --- 3. Chuẩn hóa bảng gradingslidereview ---
    try:
        cursor.execute("SELECT id, title, summary, issues, suggestions FROM gradingslidereview")
        slides = cursor.fetchall()
        updated_slides = 0
        for slide_id, title, summary, issues, suggestions in slides:
            new_title = wrap_bilingual(title, default_lang="vi")
            new_summary = wrap_bilingual(summary, default_lang="vi")
            new_issues = wrap_bilingual(issues, default_lang="vi", is_list=True)
            new_suggestions = wrap_bilingual(suggestions, default_lang="vi")
            
            if (new_title != title or new_summary != summary or 
                new_issues != issues or new_suggestions != suggestions):
                cursor.execute(
                    """UPDATE gradingslidereview 
                       SET title = ?, summary = ?, issues = ?, suggestions = ? 
                       WHERE id = ?""",
                    (new_title, new_summary, new_issues, new_suggestions, slide_id)
                )
                updated_slides += 1
        print(f" -> Normalized {updated_slides}/{len(slides)} records in 'gradingslidereview'.")
    except sqlite3.OperationalError as e:
        print(f" Skipped gradingslidereview: {e}")

    # --- 4. Chuẩn hóa bảng promptversion ---
    try:
        cursor.execute("SELECT id, level, content FROM promptversion")
        prompts = cursor.fetchall()
        updated_prompts = 0
        LEVEL_LABELS_JA = {
            "low": "PMO低レベル",
            "medium": "PMO中レベル",
            "high": "PMO高レベル",
        }
        for prompt_id, level, content in prompts:
            if content and isinstance(content, str) and not content.strip().startswith("{"):
                ja_text = (
                    f"評価レベル: {LEVEL_LABELS_JA.get(level, 'PMO中レベル')}。 "
                    "常に選択したルーブリック/バージョンに従い、ルーブリック外の基準は使用しないでください。 "
                    "結果はスコア、問題点、スライド/ページ、および次のアクションを説明できる必要があります。"
                )
                new_content = json.dumps({"vi": content.strip(), "ja": ja_text}, ensure_ascii=False)
                cursor.execute("UPDATE promptversion SET content = ? WHERE id = ?", (new_content, prompt_id))
                updated_prompts += 1
        print(f" -> Normalized {updated_prompts}/{len(prompts)} records in 'promptversion'.")
    except sqlite3.OperationalError as e:
        print(f" Skipped promptversion: {e}")

    # --- 5. Chuẩn hóa bảng evaluationpolicy ---
    try:
        cursor.execute("SELECT id, level, content FROM evaluationpolicy")
        policies = cursor.fetchall()
        updated_policies = 0
        policy_json_path = Path(__file__).resolve().parent.parent / "app" / "defaults" / "global_policies.json"
        global_pol = {}
        if policy_json_path.exists():
            with open(policy_json_path, "r", encoding="utf-8") as f:
                global_pol = json.load(f)
                
        for pol_id, level, content in policies:
            if content and isinstance(content, str) and not content.strip().startswith("{"):
                ja_text = global_pol.get(level, {}).get("ja", content.strip())
                new_content = json.dumps({"vi": content.strip(), "ja": ja_text}, ensure_ascii=False)
                cursor.execute("UPDATE evaluationpolicy SET content = ? WHERE id = ?", (new_content, pol_id))
                updated_policies += 1
        print(f" -> Normalized {updated_policies}/{len(policies)} records in 'evaluationpolicy'.")
    except sqlite3.OperationalError as e:
        print(f" Skipped evaluationpolicy: {e}")

    conn.commit()
    conn.close()
    print("\nBilingual normalization completed successfully!")


if __name__ == "__main__":
    migrate()
