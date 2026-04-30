from __future__ import annotations

import json
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape

from typing import Any

from app.services.issue_analytics import issue_count as count_issues
from app.services.issue_analytics import localized_issue_list


SUMMARY_COLUMNS = [
    "project_id",
    "project_name",
    "filename",
    "document_type",
    "language",
    "score",
    "uploaded_at",
    "graded_at",
    "rubric_version",
    "gemini_model",
    "prompt_hash",
    "criteria_hash",
    "grading_schema_version",
    "review_tong_the",
    "diem_tot",
    "diem_xau",
    "chinh_sach",
    "chat_luong_viet",
    "kha_nang_tai_hien_bug",
    "phan_tich_nguyen_nhan",
    "danh_gia_anh_huong",
    "giai_phap_phong_ngua",
    "do_ro_rang",
    "do_bao_phu",
    "kha_nang_truy_vet",
    "tinh_thuc_thi",
    "do_ro_rang_de_hieu",
    "tinh_day_du_dung_trong_tam",
    "tinh_chinh_xac",
    "tinh_ung_dung",
]

CRITERIA_DETAIL_COLUMNS = [
    "project_id",
    "project_name",
    "document_type",
    "language",
    "criterion_key",
    "criterion_score",
    "criterion_suggestion",
]

FEEDBACK_COLUMNS = [
    "project_id",
    "project_name",
    "document_type",
    "language",
    "score",
    "draft_feedback",
]

SLIDE_REVIEW_COLUMNS = [
    "project_id",
    "project_name",
    "document_type",
    "language",
    "slide_number",
    "status",
    "title",
    "summary",
    "issues",
    "suggestions",
]

ISSUE_SUMMARY_COLUMNS = [
    "project_id",
    "project_name",
    "document_type",
    "language",
    "score",
    "ok_slide_count",
    "ng_slide_count",
    "issue_count",
    "criteria_suggestion_count",
    "weakest_criterion_key",
    "weakest_criterion_score",
    "weakest_criterion_max",
    "weakest_criterion_ratio",
    "graded_at",
]

NG_SLIDES_COLUMNS = [
    "project_id",
    "project_name",
    "document_type",
    "language",
    "rubric_version",
    "slide_number",
    "status",
    "title_vi",
    "title_ja",
    "summary_vi",
    "summary_ja",
    "issues_vi",
    "issues_ja",
    "suggestions_vi",
    "suggestions_ja",
]

VERSION_CONTEXT_COLUMNS = [
    "project_id",
    "project_name",
    "document_type",
    "language",
    "score",
    "rubric_version",
    "gemini_model",
    "prompt_hash",
    "criteria_hash",
    "grading_schema_version",
    "graded_at",
    "criteria_result_count",
    "slide_review_count",
    "ng_slide_count",
]


def _column_name(index: int) -> str:
    result = []
    current = index
    while current >= 0:
        current, remainder = divmod(current, 26)
        result.append(chr(65 + remainder))
        current -= 1
    return "".join(reversed(result))


def _xml_cell(value: object) -> tuple[str, int]:
    if value is None:
        return "", 0

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c><v>{value}</v></c>', len(str(value))

    text = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value)
    return (
        f'<c t="inlineStr"><is><t xml:space="preserve">{escape(text)}</t></is></c>',
        len(text),
    )


def _sheet_xml(rows: list[list[object]]) -> tuple[str, list[int]]:
    max_columns = max((len(row) for row in rows), default=0)
    widths = [0] * max_columns
    row_xml: list[str] = []

    for row_index, row in enumerate(rows, start=1):
        cells: list[str] = []
        for col_index, value in enumerate(row):
            cell_xml, cell_len = _xml_cell(value)
            widths[col_index] = max(widths[col_index], cell_len)
            if cell_xml:
                cell_ref = f"{_column_name(col_index)}{row_index}"
                cells.append(cell_xml.replace("<c", f'<c r="{cell_ref}"', 1))
        row_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    cols_xml = []
    for idx, width in enumerate(widths, start=1):
        adjusted = min(max(width + 2, 12), 60)
        cols_xml.append(f'<col min="{idx}" max="{idx}" width="{adjusted}" customWidth="1"/>')

    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        f'<cols>{"".join(cols_xml)}</cols>'
        f'<sheetData>{"".join(row_xml)}</sheetData>'
        "</worksheet>"
    )
    return sheet, widths


def _criteria_scores(submission: Any) -> dict[str, float]:
    latest_run = getattr(submission, "latest_run", None)
    if not latest_run:
        return {}
    return {item.key: item.score for item in latest_run.criteria_results}


def _criteria_suggestions(submission: Any) -> dict[str, object]:
    latest_run = getattr(submission, "latest_run", None)
    if not latest_run:
        return {}
    return {item.key: item.suggestion for item in latest_run.criteria_results if item.suggestion is not None}


def _latest_score(submission: Any) -> int | None:
    latest_run = getattr(submission, "latest_run", None)
    return latest_run.score if latest_run else None


def _latest_graded_at(submission: Any) -> str | None:
    latest_run = getattr(submission, "latest_run", None)
    return latest_run.graded_at if latest_run else None


def _latest_rubric_version(submission: Any) -> str | None:
    latest_run = getattr(submission, "latest_run", None)
    return latest_run.rubric_version if latest_run else None


def _latest_gemini_model(submission: Any) -> str | None:
    latest_run = getattr(submission, "latest_run", None)
    return latest_run.gemini_model if latest_run else None


def _latest_prompt_hash(submission: Any) -> str | None:
    latest_run = getattr(submission, "latest_run", None)
    return latest_run.prompt_hash if latest_run else None


def _latest_criteria_hash(submission: Any) -> str | None:
    latest_run = getattr(submission, "latest_run", None)
    return latest_run.criteria_hash if latest_run else None


def _latest_grading_schema_version(submission: Any) -> str | None:
    latest_run = getattr(submission, "latest_run", None)
    return latest_run.grading_schema_version if latest_run else None


def _latest_feedback(submission: Any) -> object:
    latest_run = getattr(submission, "latest_run", None)
    return latest_run.draft_feedback if latest_run else None


def _latest_slide_reviews(submission: Any) -> list[Any]:
    latest_run = getattr(submission, "latest_run", None)
    return list(latest_run.slide_reviews) if latest_run else []


def _localized_text(value: Any, lang: str) -> str | None:
    if isinstance(value, dict):
        localized = value.get(lang)
        if isinstance(localized, str):
            return localized
    if isinstance(value, str):
        return value
    return None


def _localized_list(value: Any, lang: str) -> list[str]:
    return localized_issue_list(value, lang)


def _build_summary_rows(submissions: list[Any]) -> list[list[object]]:
    rows: list[list[object]] = [SUMMARY_COLUMNS]
    for submission in submissions:
        scores = _criteria_scores(submission)
        rows.append(
            [
                submission.project_id,
                submission.project_name,
                submission.filename,
                submission.document_type,
                submission.language,
                _latest_score(submission),
                submission.uploaded_at,
                _latest_graded_at(submission),
                _latest_rubric_version(submission),
                _latest_gemini_model(submission),
                _latest_prompt_hash(submission),
                _latest_criteria_hash(submission),
                _latest_grading_schema_version(submission),
                scores.get("review_tong_the"),
                scores.get("diem_tot"),
                scores.get("diem_xau"),
                scores.get("chinh_sach"),
                scores.get("chat_luong_viet"),
                scores.get("kha_nang_tai_hien_bug"),
                scores.get("phan_tich_nguyen_nhan"),
                scores.get("danh_gia_anh_huong"),
                scores.get("giai_phap_phong_ngua"),
                scores.get("do_ro_rang"),
                scores.get("do_bao_phu"),
                scores.get("kha_nang_truy_vet"),
                scores.get("tinh_thuc_thi"),
                scores.get("do_ro_rang_de_hieu"),
                scores.get("tinh_day_du_dung_trong_tam"),
                scores.get("tinh_chinh_xac"),
                scores.get("tinh_ung_dung"),
            ]
        )
    return rows


def _build_criteria_rows(submissions: list[Any]) -> list[list[object]]:
    rows: list[list[object]] = [CRITERIA_DETAIL_COLUMNS]
    for submission in submissions:
        scores = _criteria_scores(submission)
        suggestions = _criteria_suggestions(submission)
        keys = sorted(set(scores.keys()) | set(suggestions.keys()))
        if not keys:
            rows.append(
                [
                    submission.project_id,
                    submission.project_name,
                    submission.document_type,
                    submission.language,
                    "",
                    "",
                    "",
                ]
            )
            continue

        for key in keys:
            rows.append(
                [
                    submission.project_id,
                    submission.project_name,
                    submission.document_type,
                    submission.language,
                    key,
                    scores.get(key),
                    suggestions.get(key),
                ]
            )
    return rows


def _build_feedback_rows(submissions: list[Any]) -> list[list[object]]:
    rows: list[list[object]] = [FEEDBACK_COLUMNS]
    for submission in submissions:
        rows.append(
            [
                submission.project_id,
                submission.project_name,
                submission.document_type,
                submission.language,
                _latest_score(submission),
                _latest_feedback(submission),
            ]
        )
    return rows


def _build_slide_review_rows(submissions: list[Any]) -> list[list[object]]:
    rows: list[list[object]] = [SLIDE_REVIEW_COLUMNS]
    for submission in submissions:
        slide_reviews = _latest_slide_reviews(submission)
        if not slide_reviews:
            rows.append(
                [
                    submission.project_id,
                    submission.project_name,
                    submission.document_type,
                    submission.language,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                ]
            )
            continue

        for item in slide_reviews:
            rows.append(
                [
                    submission.project_id,
                    submission.project_name,
                    submission.document_type,
                    submission.language,
                    item.slide_number,
                    item.status,
                    item.title,
                    item.summary,
                    item.issues,
                    item.suggestions,
                ]
            )
    return rows


def _build_issue_summary_rows(submissions: list[Any]) -> list[list[object]]:
    rows: list[list[object]] = [ISSUE_SUMMARY_COLUMNS]
    for submission in submissions:
        slide_reviews = _latest_slide_reviews(submission)
        ok_slide_count = sum(1 for item in slide_reviews if getattr(item, "status", None) == "OK")
        ng_slide_count = sum(1 for item in slide_reviews if getattr(item, "status", None) == "NG")
        issue_count = count_issues(slide_reviews, submission.language)
        latest_run = getattr(submission, "latest_run", None)
        criteria_results = list(getattr(latest_run, "criteria_results", []) or [])
        suggestion_count = sum(1 for item in criteria_results if getattr(item, "suggestion", None) is not None)
        weakest = min(
            criteria_results,
            key=lambda item: (float(item.score) / float(item.max_score)) if getattr(item, "max_score", 0) else 1,
            default=None,
        )
        weakest_ratio = (
            round(float(weakest.score) / float(weakest.max_score), 4)
            if weakest is not None and getattr(weakest, "max_score", 0)
            else None
        )

        rows.append(
            [
                submission.project_id,
                submission.project_name,
                submission.document_type,
                submission.language,
                _latest_score(submission),
                ok_slide_count,
                ng_slide_count,
                issue_count,
                suggestion_count,
                getattr(weakest, "key", None),
                getattr(weakest, "score", None),
                getattr(weakest, "max_score", None),
                weakest_ratio,
                _latest_graded_at(submission),
            ]
        )
    return rows


def _build_ng_slide_rows(submissions: list[Any]) -> list[list[object]]:
    rows: list[list[object]] = [NG_SLIDES_COLUMNS]
    for submission in submissions:
        ng_slides = [item for item in _latest_slide_reviews(submission) if getattr(item, "status", None) == "NG"]
        if not ng_slides:
            rows.append(
                [
                    submission.project_id,
                    submission.project_name,
                    submission.document_type,
                    submission.language,
                    _latest_rubric_version(submission),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                ]
            )
            continue

        for item in ng_slides:
            rows.append(
                [
                    submission.project_id,
                    submission.project_name,
                    submission.document_type,
                    submission.language,
                    _latest_rubric_version(submission),
                    item.slide_number,
                    item.status,
                    _localized_text(getattr(item, "title", None), "vi"),
                    _localized_text(getattr(item, "title", None), "ja"),
                    _localized_text(getattr(item, "summary", None), "vi"),
                    _localized_text(getattr(item, "summary", None), "ja"),
                    "\n".join(_localized_list(getattr(item, "issues", None), "vi")),
                    "\n".join(_localized_list(getattr(item, "issues", None), "ja")),
                    _localized_text(getattr(item, "suggestions", None), "vi"),
                    _localized_text(getattr(item, "suggestions", None), "ja"),
                ]
            )
    return rows


def _build_version_context_rows(submissions: list[Any]) -> list[list[object]]:
    rows: list[list[object]] = [VERSION_CONTEXT_COLUMNS]
    for submission in submissions:
        latest_run = getattr(submission, "latest_run", None)
        slide_reviews = _latest_slide_reviews(submission)
        rows.append(
            [
                submission.project_id,
                submission.project_name,
                submission.document_type,
                submission.language,
                _latest_score(submission),
                _latest_rubric_version(submission),
                _latest_gemini_model(submission),
                _latest_prompt_hash(submission),
                _latest_criteria_hash(submission),
                _latest_grading_schema_version(submission),
                _latest_graded_at(submission),
                len(list(getattr(latest_run, "criteria_results", []) or [])),
                len(slide_reviews),
                sum(1 for item in slide_reviews if getattr(item, "status", None) == "NG"),
            ]
        )
    return rows


def build_submissions_excel(submissions: list[Any]) -> bytes:
    summary_rows = _build_summary_rows(submissions)
    criteria_rows = _build_criteria_rows(submissions)
    feedback_rows = _build_feedback_rows(submissions)
    slide_review_rows = _build_slide_review_rows(submissions)
    issue_summary_rows = _build_issue_summary_rows(submissions)
    ng_slide_rows = _build_ng_slide_rows(submissions)
    version_context_rows = _build_version_context_rows(submissions)

    sheet1_xml, _ = _sheet_xml(summary_rows)
    sheet2_xml, _ = _sheet_xml(criteria_rows)
    sheet3_xml, _ = _sheet_xml(feedback_rows)
    sheet4_xml, _ = _sheet_xml(slide_review_rows)
    sheet5_xml, _ = _sheet_xml(issue_summary_rows)
    sheet6_xml, _ = _sheet_xml(ng_slide_rows)
    sheet7_xml, _ = _sheet_xml(version_context_rows)

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet6.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet7.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""

    root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""

    workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Summary" sheetId="1" r:id="rId1"/>
    <sheet name="CriteriaDetails" sheetId="2" r:id="rId2"/>
    <sheet name="Feedback" sheetId="3" r:id="rId3"/>
    <sheet name="SlideReviews" sheetId="4" r:id="rId4"/>
    <sheet name="IssueSummary" sheetId="5" r:id="rId5"/>
    <sheet name="NGSlides" sheetId="6" r:id="rId6"/>
    <sheet name="VersionContext" sheetId="7" r:id="rId7"/>
  </sheets>
</workbook>
"""

    workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet6.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet7.xml"/>
  <Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""

    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1">
    <font><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>
"""

    core = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>AI Document Review Export</dc:title>
  <dc:creator>Codex</dc:creator>
</cp:coreProperties>
"""

    app = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>
"""

    stream = BytesIO()
    with ZipFile(stream, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", root_rels)
        archive.writestr("docProps/core.xml", core)
        archive.writestr("docProps/app.xml", app)
        archive.writestr("xl/workbook.xml", workbook)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        archive.writestr("xl/styles.xml", styles)
        archive.writestr("xl/worksheets/sheet1.xml", sheet1_xml)
        archive.writestr("xl/worksheets/sheet2.xml", sheet2_xml)
        archive.writestr("xl/worksheets/sheet3.xml", sheet3_xml)
        archive.writestr("xl/worksheets/sheet4.xml", sheet4_xml)
        archive.writestr("xl/worksheets/sheet5.xml", sheet5_xml)
        archive.writestr("xl/worksheets/sheet6.xml", sheet6_xml)
        archive.writestr("xl/worksheets/sheet7.xml", sheet7_xml)

    return stream.getvalue()
