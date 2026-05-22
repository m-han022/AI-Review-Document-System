import json
from pathlib import Path

from app.services.output_schema import validate_ai_output_shape


BASE = Path(__file__).resolve().parent.parent / "app" / "defaults"


def _load_json(name: str):
    with open(BASE / name, "r", encoding="utf-8") as f:
        return json.load(f)


def test_defaults_are_valid_utf8_json():
    _load_json("global_rules.json")
    _load_json("global_policies.json")
    _load_json("rubric_templates.json")
    _load_json("output_schema.json")


def test_rubric_template_criteria_keys_match_runtime_contract():
    templates = _load_json("rubric_templates.json")
    expected = {
        "project-review": {"review_tong_the", "diem_tot", "diem_xau", "chinh_sach"},
        "bug-analysis": {"kha_nang_tai_hien_bug", "phan_tich_nguyen_nhan", "danh_gia_anh_huong", "giai_phap_phong_ngua"},
        "qa-review": {"do_ro_rang", "do_bao_phu", "kha_nang_truy_vet", "tinh_thuc_thi"},
        "explanation-review": {"do_ro_rang_de_hieu", "tinh_day_du_dung_trong_tam", "tinh_chinh_xac", "tinh_ung_dung"},
    }
    for doc_type, keys in expected.items():
        assert doc_type in templates
        got = {item["key"] for item in templates[doc_type]["criteria"]}
        assert got == keys


def test_validate_ai_output_shape_detects_errors():
    required = ["review_tong_the", "diem_tot", "diem_xau", "chinh_sach"]
    bad = {"score": "oops"}
    errors = validate_ai_output_shape(bad, required)
    assert "invalid_type:score" in errors
    assert any(err.startswith("missing_root_key:") for err in errors)


def test_validate_ai_output_shape_accepts_valid_payload():
    required = ["review_tong_the", "diem_tot", "diem_xau", "chinh_sach"]
    good = {
        "score": 80,
        "criteria_scores": {k: 20 for k in required},
        "criteria_suggestions": {
            "vi": {k: {"evaluation": "ok", "improvement": "do"} for k in required},
            "ja": {k: {"evaluation": "ok", "improvement": "do"} for k in required},
        },
        "draft_feedback": {"vi": "ok", "ja": "ok"},
        "page_reviews": [
            {
                "page_number": 1,
                "status": "OK",
                "title": {"vi": "t", "ja": "t"},
                "summary": {"vi": "s", "ja": "s"},
                "issues": {"vi": [], "ja": []},
                "suggestions": {"vi": "x", "ja": "x"},
            }
        ],
    }
    assert validate_ai_output_shape(good, required) == []
