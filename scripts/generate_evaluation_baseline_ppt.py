from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


OUT_PATH = Path("artifacts") / "Evaluation_Baseline_Business_Expansion.pptx"


BG = RGBColor(243, 247, 250)
SURFACE = RGBColor(255, 255, 255)
SURFACE_ALT = RGBColor(247, 250, 252)
BORDER = RGBColor(219, 229, 237)
TEXT = RGBColor(22, 40, 65)
TEXT_SOFT = RGBColor(88, 105, 124)
MUTED = RGBColor(136, 149, 166)
NAVY = RGBColor(37, 69, 104)
BLUE = RGBColor(48, 114, 196)
TEAL = RGBColor(39, 144, 132)
GREEN = RGBColor(56, 161, 105)
AMBER = RGBColor(211, 130, 52)
RED = RGBColor(197, 74, 74)
SOFT_NAVY = RGBColor(234, 241, 248)
SOFT_BLUE = RGBColor(236, 244, 253)
SOFT_TEAL = RGBColor(235, 248, 246)
SOFT_GREEN = RGBColor(237, 248, 241)
SOFT_AMBER = RGBColor(253, 246, 236)
SOFT_RED = RGBColor(252, 240, 240)


def set_bg(slide, color=BG):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = color


def add_textbox(
    slide,
    left,
    top,
    width,
    height,
    text="",
    font_size=18,
    bold=False,
    color=TEXT,
    font_name="Aptos",
    align=PP_ALIGN.LEFT,
):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    p = tf.paragraphs[0]
    p.text = text
    p.alignment = align
    run = p.runs[0]
    run.font.name = font_name
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.color.rgb = color
    return box


def add_card(slide, left, top, width, height, fill=SURFACE, line=BORDER, shape_type=MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE):
    shape = slide.shapes.add_shape(shape_type, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line
    shape.line.width = Pt(1)
    return shape


def add_pill(slide, left, top, width, height, text, fill=BLUE, color=SURFACE, font_size=14):
    pill = add_card(slide, left, top, width, height, fill=fill, line=fill)
    tf = pill.text_frame
    tf.clear()
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = text
    run.font.name = "Aptos"
    run.font.size = Pt(font_size)
    run.font.bold = True
    run.font.color.rgb = color
    return pill


def add_section_title(slide, eyebrow, title, subtitle=None):
    add_textbox(slide, Inches(0.7), Inches(0.35), Inches(4.2), Inches(0.3), eyebrow, 11.5, True, TEAL)
    add_textbox(slide, Inches(0.7), Inches(0.68), Inches(8.3), Inches(0.55), title, 24, True, TEXT)
    if subtitle:
        add_textbox(slide, Inches(0.7), Inches(1.22), Inches(10.9), Inches(0.5), subtitle, 12.5, False, TEXT_SOFT)


def add_bullet_list(slide, left, top, width, items, bullet_color=TEAL, font_size=15, line_gap=0.43):
    y = top
    for item in items:
        dot = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, left, y + Inches(0.09), Inches(0.08), Inches(0.08))
        dot.fill.solid()
        dot.fill.fore_color.rgb = bullet_color
        dot.line.color.rgb = bullet_color
        add_textbox(slide, left + Inches(0.16), y, width - Inches(0.16), Inches(0.36), item, font_size, False, TEXT_SOFT)
        y += Inches(line_gap)


def add_metric(slide, left, top, width, value, label, accent, soft):
    add_card(slide, left, top, width, Inches(1.6))
    badge = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, left + Inches(0.18), top + Inches(0.18), Inches(0.58), Inches(0.42))
    badge.fill.solid()
    badge.fill.fore_color.rgb = soft
    badge.line.color.rgb = soft
    add_textbox(slide, left + Inches(0.18), top + Inches(0.21), Inches(0.58), Inches(0.2), "■", 16, True, accent, align=PP_ALIGN.CENTER)
    add_textbox(slide, left + Inches(0.18), top + Inches(0.68), width - Inches(0.36), Inches(0.42), value, 22, True, accent)
    add_textbox(slide, left + Inches(0.18), top + Inches(1.05), width - Inches(0.36), Inches(0.28), label, 11.5, True, TEXT_SOFT)


def add_flow_step(slide, left, top, width, number, title, body, accent, soft):
    add_card(slide, left, top, width, Inches(1.95))
    add_pill(slide, left + Inches(0.14), top + Inches(0.14), Inches(0.52), Inches(0.3), number, fill=accent, font_size=12)
    icon = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, left + Inches(0.14), top + Inches(0.58), Inches(0.62), Inches(0.5))
    icon.fill.solid()
    icon.fill.fore_color.rgb = soft
    icon.line.color.rgb = soft
    add_textbox(slide, left + Inches(0.14), top + Inches(0.66), Inches(0.62), Inches(0.18), "■", 15, True, accent, align=PP_ALIGN.CENTER)
    add_textbox(slide, left + Inches(0.84), top + Inches(0.18), width - Inches(0.98), Inches(0.32), title, 14, True, accent)
    add_textbox(slide, left + Inches(0.84), top + Inches(0.58), width - Inches(0.98), Inches(0.75), body, 11.5, False, TEXT_SOFT)


def build_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Slide 1
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    hero = add_card(slide, Inches(0.35), Inches(0.35), Inches(12.63), Inches(6.75))
    hero.shadow.inherit = False
    add_textbox(slide, Inches(0.85), Inches(0.72), Inches(4.5), Inches(0.3), "EVALUATION BASELINE", 12, True, TEAL)
    add_textbox(slide, Inches(0.85), Inches(1.05), Inches(7.1), Inches(1.0), "Dinh huong mo rong nghiep vu\nAI Review tai lieu", 25, True, TEXT)
    add_textbox(
        slide,
        Inches(0.85),
        Inches(2.1),
        Inches(6.1),
        Inches(0.6),
        "Baseline de xay dung he thong review de dung, de van hanh, de audit va de mo rong.",
        15,
        False,
        TEXT_SOFT,
    )
    add_pill(slide, Inches(0.85), Inches(2.85), Inches(2.4), Inches(0.42), "Scope -> Active Bundle", fill=BLUE)
    add_pill(slide, Inches(3.45), Inches(2.85), Inches(2.2), Inches(0.42), "Risk by Context", fill=TEAL)
    add_pill(slide, Inches(5.85), Inches(2.85), Inches(2.05), Inches(0.42), "User-first UX", fill=GREEN)
    add_metric(slide, Inches(0.95), Inches(4.2), Inches(2.45), "3", "Muc tieu van hanh", BLUE, SOFT_BLUE)
    add_metric(slide, Inches(3.8), Inches(4.2), Inches(2.45), "2", "Vai tro UI chinh", TEAL, SOFT_TEAL)
    add_metric(slide, Inches(6.65), Inches(4.2), Inches(2.45), "1", "Bundle active / scope", GREEN, SOFT_GREEN)
    add_metric(slide, Inches(9.5), Inches(4.2), Inches(2.45), "Low change", "Tac dong he thong", AMBER, SOFT_AMBER)
    add_card(slide, Inches(8.75), Inches(0.95), Inches(3.2), Inches(2.5), fill=SURFACE_ALT)
    add_textbox(slide, Inches(9.0), Inches(1.2), Inches(2.7), Inches(0.28), "Thong diep chot", 12, True, NAVY)
    add_bullet_list(
        slide,
        Inches(9.0),
        Inches(1.6),
        Inches(2.65),
        [
            "Khong de document_type ganh toan bo nghiep vu",
            "Khong bat user hoc them nhieu khai niem ky thuat",
            "Khong de admin cau hinh lai tu dau moi lan",
        ],
        bullet_color=AMBER,
        font_size=12.5,
        line_gap=0.46,
    )

    # Slide 2
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "01 / Business Problem",
        "Vi sao can doi tu document_type -> evaluation bundle",
        "Neu tiep tuc gan mot bo tieu chuan co dinh cho moi loai tai lieu, he thong se phinh nhanh va kho van hanh.",
    )
    add_card(slide, Inches(0.75), Inches(1.95), Inches(5.85), Inches(4.95), fill=SOFT_RED, line=SOFT_RED)
    add_textbox(slide, Inches(1.0), Inches(2.2), Inches(2.2), Inches(0.3), "Mo hinh cu", 17, True, RED)
    add_textbox(slide, Inches(1.0), Inches(2.58), Inches(4.9), Inches(0.6), "document_type -> evaluation set", 24, True, TEXT)
    add_bullet_list(
        slide,
        Inches(1.0),
        Inches(3.3),
        Inches(5.0),
        [
            "Document type bi bien thanh noi nhung tat ca ngoai le nghiep vu",
            "Rubric, prompt, policy bi copy-paste va kho version",
            "Admin kho biet bo nao dang active va vi sao phai doi",
            "User kho hieu tai sao cung mot loai tai lieu lai cho ket qua khac nhau",
        ],
        bullet_color=RED,
    )
    add_card(slide, Inches(6.85), Inches(1.95), Inches(5.75), Inches(4.95), fill=SOFT_GREEN, line=SOFT_GREEN)
    add_textbox(slide, Inches(7.1), Inches(2.2), Inches(2.5), Inches(0.3), "Mo hinh de xuat", 17, True, GREEN)
    add_textbox(slide, Inches(7.1), Inches(2.58), Inches(4.9), Inches(0.6), "(document_type, strictness) -> active bundle", 22, True, TEXT)
    add_bullet_list(
        slide,
        Inches(7.1),
        Inches(3.3),
        Inches(4.9),
        [
            "UI van don gian voi loai tai lieu va muc danh gia",
            "Backend tach rieng bundle de version va activate an toan",
            "Admin quan ly theo scope ro rang, moi scope chi co 1 bundle active",
            "Mo rong sau nay duoc ma khong phai dap lai UX cho user thuong",
        ],
        bullet_color=GREEN,
    )

    # Slide 3
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "02 / Operating Goals",
        "He thong phuc vu 3 muc tieu review",
        "Khong chi cham diem. He thong can ho tro cai thien tai lieu, quality gate va canh bao rui ro.",
    )
    goals = [
        ("Cai thien chat luong", "Tim thieu sot, diem mo ho, phan can bo sung va dua ra goi y sua.", BLUE, SOFT_BLUE),
        ("Chot release / quality gate", "Ho tro quyet dinh pass, conditional pass hoac fail cho buoc tiep theo.", GREEN, SOFT_GREEN),
        ("Canh bao rui ro theo boi canh du an", "Phat hien risk signal dua tren project context va noi dung tai lieu.", AMBER, SOFT_AMBER),
    ]
    for idx, (title, body, accent, soft) in enumerate(goals):
        left = Inches(0.85 + idx * 4.15)
        add_card(slide, left, Inches(2.15), Inches(3.65), Inches(3.9))
        add_pill(slide, left + Inches(0.18), Inches(2.33), Inches(1.7), Inches(0.34), f"Goal {idx + 1}", fill=accent, font_size=12)
        add_textbox(slide, left + Inches(0.18), Inches(2.8), Inches(3.05), Inches(0.52), title, 17, True, accent)
        add_textbox(slide, left + Inches(0.18), Inches(3.45), Inches(3.05), Inches(1.25), body, 13, False, TEXT_SOFT)
    add_card(slide, Inches(0.85), Inches(6.3), Inches(12.0), Inches(0.55), fill=SURFACE_ALT)
    add_textbox(
        slide,
        Inches(1.05),
        Inches(6.45),
        Inches(11.4),
        Inches(0.2),
        "Thong diep: cung mot tai lieu co the duoc review de cai thien chat luong, de chot release, va de canh bao rui ro. Bundle can phuc vu cac muc tieu nay ma khong lam UI roi.",
        12.5,
        False,
        NAVY,
    )

    # Slide 4
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "03 / Scope Model",
        "Scope toi gian de de van hanh",
        "Giai doan dau chi expose document_type va strictness tren UI, nhung backend duoc thiet ke de mo rong.",
    )
    add_card(slide, Inches(0.8), Inches(2.0), Inches(4.2), Inches(4.8))
    add_textbox(slide, Inches(1.05), Inches(2.3), Inches(2.5), Inches(0.3), "Scope hien tai", 17, True, TEXT)
    add_textbox(slide, Inches(1.05), Inches(2.7), Inches(3.2), Inches(0.6), "(document_type, strictness)", 24, True, BLUE)
    add_bullet_list(
        slide,
        Inches(1.05),
        Inches(3.55),
        Inches(3.3),
        [
            "De hieu voi user",
            "De mapping bundle",
            "Khong doi flow upload/review qua nhieu",
            "Du de mo dau cho admin va dashboard",
            "Document type mo rong qua master data, strictness mo rong co kiem soat",
        ],
        bullet_color=BLUE,
    )
    add_card(slide, Inches(5.25), Inches(2.0), Inches(7.25), Inches(4.8))
    add_textbox(slide, Inches(5.55), Inches(2.3), Inches(3.8), Inches(0.3), "Huong mo rong sau nay", 17, True, TEXT)
    add_textbox(slide, Inches(5.55), Inches(2.7), Inches(5.8), Inches(0.65), "(document_type, objective, context_profile, strictness)", 19, True, GREEN)
    add_bullet_list(
        slide,
        Inches(5.55),
        Inches(3.55),
        Inches(6.0),
        [
            "Chi mo rong khi co nhu cau thuc su va data readiness",
            "Khong dua objective/context_profile ra UI dai tra qua som",
            "Co the bo sung backend ma van giu UI user co ban",
            "Khong encode ngoai le nghiep vu vao ten document_type",
        ],
        bullet_color=GREEN,
    )

    # Slide 5
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "04 / Controlled Expansion",
        "Mo rong Loai tai lieu va Muc danh gia theo kiem soat",
        "Loai tai lieu la truc mo rong nghiep vu. Muc danh gia la truc mo rong cuong do danh gia va nen giu gon.",
    )
    add_card(slide, Inches(0.8), Inches(2.0), Inches(5.85), Inches(4.85), fill=SOFT_BLUE, line=SOFT_BLUE)
    add_textbox(slide, Inches(1.05), Inches(2.28), Inches(2.9), Inches(0.28), "Loai tai lieu", 17, True, BLUE)
    add_bullet_list(
        slide,
        Inches(1.05),
        Inches(2.78),
        Inches(5.0),
        [
            "La master data va la truc mo rong nghiep vu chinh",
            "Moi document_type nen co code, name, description, status",
            "Co the them loai tai lieu moi qua catalog",
            "Khong tao ten kieu BRD_Banking_High hay Proposal_Japan_Strict",
        ],
        bullet_color=BLUE,
    )
    add_card(slide, Inches(6.95), Inches(2.0), Inches(5.55), Inches(4.85), fill=SOFT_GREEN, line=SOFT_GREEN)
    add_textbox(slide, Inches(7.25), Inches(2.28), Inches(2.9), Inches(0.28), "Muc danh gia", 17, True, GREEN)
    add_bullet_list(
        slide,
        Inches(7.25),
        Inches(2.78),
        Inches(4.8),
        [
            "Baseline giu low / medium / high",
            "Co the doi nhan hien thi thanh Co ban / Tieu chuan / Nghiem ngat",
            "Chi mo rong khi co nhu cau van hanh ro rang",
            "Uu tien them metadata truoc khi tao them muc moi",
        ],
        bullet_color=GREEN,
    )

    # Slide 7
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "05 / Bundle Design",
        "Bundle la artifact chay AI, khong phai form ky thuat user phai hoc",
        "Bundle can mong, versioned, immutable va dung lai toi da phan dung chung.",
    )
    add_card(slide, Inches(0.8), Inches(2.0), Inches(5.85), Inches(4.85))
    add_textbox(slide, Inches(1.05), Inches(2.28), Inches(2.7), Inches(0.28), "Phan dung chung", 17, True, TEAL)
    add_bullet_list(
        slide,
        Inches(1.05),
        Inches(2.78),
        Inches(5.0),
        [
            "Required Rules default toan he thong",
            "Output Schema default toan he thong",
            "Policy preset co ban: Low / Medium / High",
        ],
        bullet_color=TEAL,
    )
    add_textbox(slide, Inches(1.05), Inches(4.55), Inches(2.7), Inches(0.28), "Phan rieng theo loai tai lieu", 17, True, BLUE)
    add_bullet_list(
        slide,
        Inches(1.05),
        Inches(5.05),
        Inches(5.0),
        [
            "Rubric theo document_type",
            "Prompt theo document_type",
            "Override chi la ngoai le, khong phai mac dinh",
        ],
        bullet_color=BLUE,
    )
    add_card(slide, Inches(6.95), Inches(2.0), Inches(5.55), Inches(4.85), fill=SOFT_NAVY, line=SOFT_NAVY)
    add_textbox(slide, Inches(7.25), Inches(2.28), Inches(2.8), Inches(0.28), "Bundle backend", 17, True, NAVY)
    add_bullet_list(
        slide,
        Inches(7.25),
        Inches(2.78),
        Inches(4.7),
        [
            "bundle_id, scope_id",
            "rubric_version_id",
            "prompt_version_id",
            "policy_version_id",
            "required_rules_version_id",
            "output_schema_version_id",
            "status, validation_status",
            "created_by / approved_by / activated_by",
        ],
        bullet_color=NAVY,
        font_size=13,
        line_gap=0.39,
    )

    # Slide 6
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "06 / UX Principle",
        "Giảm ganh nang cho user va admin",
        "Nguoi dung chi thay du thao tac nghiep vu. Admin khong cau hinh tat ca tu dau.",
    )
    add_card(slide, Inches(0.75), Inches(1.95), Inches(5.9), Inches(4.95))
    add_textbox(slide, Inches(1.0), Inches(2.2), Inches(2.3), Inches(0.3), "User thuong", 18, True, BLUE)
    add_bullet_list(
        slide,
        Inches(1.0),
        Inches(2.75),
        Inches(5.0),
        [
            "Chon Project",
            "Chon Loai tai lieu",
            "Chon Muc danh gia",
            "Upload va bat dau review",
            "Xem Bo tieu chuan dang ap dung o dang read-only",
            "Xem ket qua review va canh bao rui ro",
        ],
        bullet_color=BLUE,
    )
    add_card(slide, Inches(6.85), Inches(1.95), Inches(5.75), Inches(4.95))
    add_textbox(slide, Inches(7.1), Inches(2.2), Inches(2.5), Inches(0.3), "Admin / PMO", 18, True, TEAL)
    add_bullet_list(
        slide,
        Inches(7.1),
        Inches(2.75),
        Inches(4.95),
        [
            "Xem scope va active bundle hien tai",
            "Clone tu bundle dang dung",
            "Chinh Rubric / Prompt / Policy khi can",
            "Validate roi Activate",
            "Khong sua truc tiep bundle active",
        ],
        bullet_color=TEAL,
    )
    add_pill(slide, Inches(4.95), Inches(6.2), Inches(3.35), Inches(0.38), "Clone -> Validate -> Activate", fill=GREEN, font_size=13)

    # Slide 8
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "07 / Admin Simplicity",
        "Admin thuc te chi nen chon 4 thanh phan cot loi",
        "Metadata ky thuat va audit de he thong tu quan ly.",
    )
    add_card(slide, Inches(0.8), Inches(2.0), Inches(5.9), Inches(4.9), fill=SOFT_GREEN, line=SOFT_GREEN)
    add_textbox(slide, Inches(1.05), Inches(2.28), Inches(3.0), Inches(0.28), "Admin chu dong chon", 17, True, GREEN)
    add_bullet_list(
        slide,
        Inches(1.05),
        Inches(2.8),
        Inches(5.0),
        [
            "Loai tai lieu",
            "Muc danh gia",
            "Rubric",
            "Prompt",
            "Policy",
            "Ghi chu thay doi",
        ],
        bullet_color=GREEN,
    )
    add_card(slide, Inches(6.95), Inches(2.0), Inches(5.5), Inches(4.9), fill=SOFT_BLUE, line=SOFT_BLUE)
    add_textbox(slide, Inches(7.2), Inches(2.28), Inches(2.7), Inches(0.28), "He thong tu quan ly", 17, True, BLUE)
    add_bullet_list(
        slide,
        Inches(7.2),
        Inches(2.8),
        Inches(4.7),
        [
            "Bundle ID",
            "Required Rules version",
            "Output Schema version",
            "Validation status",
            "Created by / Approved by / Activated by",
            "Thoi diem tao / duyet / kich hoat",
        ],
        bullet_color=BLUE,
    )

    # Slide 9
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "08 / Runtime Flow",
        "Luong review toi gian nhung dung kien truc",
        "User flow khong doi nhieu, nhung backend resolve bundle va boi canh de tao ket qua giau hon.",
    )
    steps = [
        ("01", "User chon project", "Nghiep vu tai lieu thuoc project nao", BLUE, SOFT_BLUE),
        ("02", "Chon scope", "Loai tai lieu + muc danh gia", TEAL, SOFT_TEAL),
        ("03", "Resolve bundle", "Lay bundle active theo scope", GREEN, SOFT_GREEN),
        ("04", "Nap context", "Project context + document content", AMBER, SOFT_AMBER),
        ("05", "AI review", "Document assessment + risk warnings", NAVY, SOFT_NAVY),
    ]
    step_left = Inches(0.72)
    step_top = Inches(2.1)
    step_w = Inches(2.4)
    gap = Inches(0.14)
    for index, step in enumerate(steps):
        add_flow_step(slide, step_left + index * (step_w + gap), step_top, step_w, *step)
        if index < len(steps) - 1:
            x1 = step_left + index * (step_w + gap) + step_w + Inches(0.02)
            y = step_top + Inches(0.95)
            conn = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, x1, y, x1 + Inches(0.1), y)
            conn.line.color.rgb = MUTED
            conn.line.width = Pt(2)
    add_card(slide, Inches(0.8), Inches(5.15), Inches(12.0), Inches(1.4), fill=SURFACE_ALT)
    add_bullet_list(
        slide,
        Inches(1.0),
        Inches(5.45),
        Inches(11.2),
        [
            "Moi grading run phai luu bundle thuc te da dung de audit va replay",
            "Project context khong thay the noi dung tai lieu; no chi bo sung can cu de phat hien rui ro",
        ],
        bullet_color=NAVY,
        font_size=14,
        line_gap=0.5,
    )

    # Slide 10
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "09 / Project Risk Warnings",
        "Gia tri mo rong lon nhat: canh bao rui ro dua tren boi canh du an",
        "Tinh nang nay tang gia tri van hanh, nhung phai giu ky luat de tranh 'AI risk score' mo ho.",
    )
    add_card(slide, Inches(0.8), Inches(1.95), Inches(4.55), Inches(4.95))
    add_textbox(slide, Inches(1.05), Inches(2.22), Inches(2.8), Inches(0.28), "Project context toi thieu", 17, True, AMBER)
    add_bullet_list(
        slide,
        Inches(1.05),
        Inches(2.78),
        Inches(3.9),
        [
            "project_description",
            "project_domain",
            "project_phase",
            "target_milestone",
            "known_constraints",
            "known_dependencies",
            "criticality_level",
        ],
        bullet_color=AMBER,
    )
    add_card(slide, Inches(5.6), Inches(1.95), Inches(6.95), Inches(4.95))
    add_textbox(slide, Inches(5.9), Inches(2.22), Inches(3.1), Inches(0.28), "Rule de dang tin", 17, True, RED)
    add_bullet_list(
        slide,
        Inches(5.9),
        Inches(2.78),
        Inches(6.1),
        [
            "Chi canh bao khi co bang chung tu document, project context hoac rule kiem tra da dinh nghia",
            "Khong tao AI confidence score gia",
            "Khong tao risk score gia",
            "Neu khong du thong tin thi phai noi ro khong du thong tin de ket luan",
            "Moi risk warning phai co: title, severity, reason, evidence, recommended_action",
        ],
        bullet_color=RED,
    )

    # Slide 11
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "10 / Example Output",
        "Ket qua review mong muon",
        "Review khong chi tra diem. Can co dau ra de user thao tac tiep va de PMO quyet dinh.",
    )
    add_card(slide, Inches(0.8), Inches(2.0), Inches(4.6), Inches(4.85))
    add_textbox(slide, Inches(1.05), Inches(2.28), Inches(2.3), Inches(0.28), "Document assessment", 17, True, BLUE)
    add_bullet_list(
        slide,
        Inches(1.05),
        Inches(2.8),
        Inches(3.9),
        [
            "total_score",
            "criteria_scores",
            "summary",
            "strengths",
            "gaps",
            "recommended_improvements",
        ],
        bullet_color=BLUE,
    )
    add_card(slide, Inches(5.65), Inches(2.0), Inches(6.8), Inches(4.85))
    add_textbox(slide, Inches(5.95), Inches(2.28), Inches(2.8), Inches(0.28), "Risk warning example", 17, True, AMBER)
    code = [
        "{",
        '  "title": "Missing integration dependency details",',
        '  "severity": "high",',
        '  "reason": "Legacy integration exists but document omits dependency points.",',
        '  "evidence": ["Project context: legacy integration", "Document: no dependency map"],',
        '  "recommended_action": "Add owner, dependency map, fallback handling."',
        "}",
    ]
    add_textbox(slide, Inches(5.95), Inches(2.78), Inches(5.95), Inches(2.45), "\n".join(code), 13, False, NAVY)
    add_card(slide, Inches(5.9), Inches(5.55), Inches(5.9), Inches(0.7), fill=SOFT_AMBER, line=SOFT_AMBER)
    add_textbox(
        slide,
        Inches(6.15),
        Inches(5.76),
        Inches(5.45),
        Inches(0.2),
        "Y nghia van hanh: PMO thay ngay risk nao can xu ly truoc khi qua release gate.",
        12.5,
        False,
        TEXT,
    )

    # Slide 12
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "11 / Learning Rollout",
        "Review result can duoc bien thanh tri thuc to chuc",
        "Khong chi review tung tai lieu. He thong nen tong hop learning case hang thang de chia se ngang toan cong ty.",
    )
    add_card(slide, Inches(0.8), Inches(2.0), Inches(5.7), Inches(4.9), fill=SOFT_GREEN, line=SOFT_GREEN)
    add_textbox(slide, Inches(1.05), Inches(2.28), Inches(2.8), Inches(0.28), "Learning case tu review", 17, True, GREEN)
    add_bullet_list(
        slide,
        Inches(1.05),
        Inches(2.8),
        Inches(4.9),
        [
            "Tong hop best practices, recurring issues, risk patterns",
            "Tao learning candidates tu review result",
            "Human curation truoc khi publish",
            "Dung cho monthly digest va Learning Hub",
        ],
        bullet_color=GREEN,
    )
    add_card(slide, Inches(6.8), Inches(2.0), Inches(5.7), Inches(4.9), fill=SOFT_BLUE, line=SOFT_BLUE)
    add_textbox(slide, Inches(7.05), Inches(2.28), Inches(3.0), Inches(0.28), "Monthly curation flow", 17, True, BLUE)
    add_bullet_list(
        slide,
        Inches(7.05),
        Inches(2.8),
        Inches(4.8),
        [
            "Review result -> Learning candidates",
            "PMO / owner curate",
            "Approve",
            "Publish vao monthly digest, searchable knowledge base",
        ],
        bullet_color=BLUE,
    )

    # Slide 13
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "12 / Reference Snippets",
        "Hoc tu noi dung tai lieu input, khong chi tu ket qua cham",
        "Nhung doan mo ta tot, cau truc section tot, va reusable patterns cung nen duoc trich xuat de chia se.",
    )
    add_card(slide, Inches(0.8), Inches(2.0), Inches(5.75), Inches(4.9), fill=SOFT_AMBER, line=SOFT_AMBER)
    add_textbox(slide, Inches(1.05), Inches(2.28), Inches(2.8), Inches(0.28), "Reference snippets", 17, True, AMBER)
    add_bullet_list(
        slide,
        Inches(1.05),
        Inches(2.8),
        Inches(4.9),
        [
            "Trich doan requirement, risk, dependency, summary viet tot",
            "Gan why_good va reuse_guidance",
            "Phan loai theo document_type va knowledge_area",
            "Masking du lieu nhay cam truoc khi publish",
        ],
        bullet_color=AMBER,
    )
    add_card(slide, Inches(6.85), Inches(2.0), Inches(5.65), Inches(4.9), fill=SOFT_NAVY, line=SOFT_NAVY)
    add_textbox(slide, Inches(7.1), Inches(2.28), Inches(3.0), Inches(0.28), "Reusable patterns", 17, True, NAVY)
    add_bullet_list(
        slide,
        Inches(7.1),
        Inches(2.8),
        Inches(4.8),
        [
            "Executive summary pattern",
            "Dependency mapping pattern",
            "Risk section pattern",
            "Acceptance criteria pattern",
            "Snippet library va pattern library de rollout ngang",
        ],
        bullet_color=NAVY,
    )

    # Slide 14
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "13 / UI Baseline",
        "UI toi gian de than thien voi user",
        "Khong expose qua nhieu khai niem ky thuat. Duy tri ngon ngu nghiep vu de de chap nhan hon.",
    )
    add_card(slide, Inches(0.78), Inches(2.0), Inches(4.0), Inches(4.9))
    add_textbox(slide, Inches(1.02), Inches(2.28), Inches(2.3), Inches(0.28), "Man user review", 17, True, GREEN)
    add_bullet_list(
        slide,
        Inches(1.02),
        Inches(2.8),
        Inches(3.45),
        [
            "Project",
            "Loai tai lieu",
            "Muc danh gia",
            "Bo tieu chuan dang ap dung",
            "Ket qua review",
            "Canh bao rui ro",
        ],
        bullet_color=GREEN,
    )
    add_card(slide, Inches(4.98), Inches(2.0), Inches(3.6), Inches(4.9))
    add_textbox(slide, Inches(5.22), Inches(2.28), Inches(2.0), Inches(0.28), "Man danh sach config", 17, True, BLUE)
    add_bullet_list(
        slide,
        Inches(5.22),
        Inches(2.8),
        Inches(3.0),
        [
            "Loai tai lieu",
            "Muc danh gia",
            "Bo tieu chuan hien tai",
            "Phien ban",
            "Trang thai",
            "Action: Xem / Tao phien ban moi / Kiem tra / Kich hoat",
        ],
        bullet_color=BLUE,
        font_size=13.2,
    )
    add_card(slide, Inches(8.78), Inches(2.0), Inches(3.8), Inches(4.9))
    add_textbox(slide, Inches(9.02), Inches(2.28), Inches(2.0), Inches(0.28), "Man chi tiet bundle", 17, True, TEAL)
    add_bullet_list(
        slide,
        Inches(9.02),
        Inches(2.8),
        Inches(3.2),
        [
            "Rubric",
            "Prompt",
            "Policy",
            "Ghi chu thay doi",
            "Advanced: Rules / Schema / Validation / Audit metadata",
        ],
        bullet_color=TEAL,
        font_size=13.2,
    )

    # Slide 15
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "14 / Execution Roadmap",
        "Thu tu trien khai de khong ngat quang he thong",
        "Roadmap nen di tu governance va contract nen tang, sau do moi mo rong risk, learning, universal input va external connectors.",
    )
    phases = [
        ("P1-P2", "Governance + scope/bundle foundation", BLUE, SOFT_BLUE),
        ("P3-P4", "Runtime contract + UI baseline", TEAL, SOFT_TEAL),
        ("P5-P7", "Risk + learning case + snippets", GREEN, SOFT_GREEN),
        ("P8-P9", "Universal input + external sources", AMBER, SOFT_AMBER),
    ]
    for idx, (label, body, accent, soft) in enumerate(phases):
        left = Inches(0.85 + idx * 3.1)
        add_card(slide, left, Inches(2.1), Inches(2.75), Inches(3.5), fill=SURFACE, line=BORDER)
        add_pill(slide, left + Inches(0.18), Inches(2.28), Inches(0.95), Inches(0.34), label, fill=accent, font_size=12)
        add_textbox(slide, left + Inches(0.18), Inches(2.82), Inches(2.3), Inches(0.9), body, 14, True, TEXT)
        add_textbox(
            slide,
            left + Inches(0.18),
            Inches(4.2),
            Inches(2.3),
            Inches(0.8),
            "Owner chinh: PMO/Product, Backend, Frontend/Design, Security/QA",
            11.5,
            False,
            TEXT_SOFT,
        )
    add_card(slide, Inches(0.9), Inches(6.1), Inches(11.7), Inches(0.5), fill=SURFACE_ALT)
    add_textbox(
        slide,
        Inches(1.1),
        Inches(6.25),
        Inches(11.2),
        Inches(0.2),
        "Rule: chi expose UI moi sau khi backend contract on dinh; moi phase phai co rollback point va default path.",
        12.2,
        False,
        NAVY,
    )

    # Slide 16
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    add_section_title(
        slide,
        "15 / Roadmap",
        "Lo trinh trien khai an toan",
        "Lam theo pha de han che regression va tranh mo qua nhieu khai niem ngay tu dau.",
    )
    phases = [
        ("Phase 1", "scope = (document_type, strictness)\nGlobal rules/schema\nAdmin quan ly rubric/prompt/policy", BLUE, SOFT_BLUE),
        ("Phase 2", "Bundle lifecycle day du\nVersion compare\nRisk warning block trong UI", TEAL, SOFT_TEAL),
        ("Phase 3", "Mo rong objective/context_profile neu can\nKhong doi UX co ban cua user thuong", GREEN, SOFT_GREEN),
    ]
    for idx, (title, body, accent, soft) in enumerate(phases):
        left = Inches(0.95 + idx * 4.08)
        add_card(slide, left, Inches(2.15), Inches(3.55), Inches(3.75))
        add_pill(slide, left + Inches(0.18), Inches(2.33), Inches(1.15), Inches(0.34), title, fill=accent, font_size=12)
        add_textbox(slide, left + Inches(0.18), Inches(2.9), Inches(3.05), Inches(1.35), body, 14, False, TEXT)
        band = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, left + Inches(0.18), Inches(5.35), Inches(3.0), Inches(0.06))
        band.fill.solid()
        band.fill.fore_color.rgb = accent
        band.line.color.rgb = accent
    add_card(slide, Inches(0.95), Inches(6.2), Inches(11.6), Inches(0.45), fill=SURFACE_ALT)
    add_textbox(
        slide,
        Inches(1.15),
        Inches(6.32),
        Inches(11.1),
        Inches(0.16),
        "Nguyen tac: chi mo rong backend va governance khi co nhu cau ro, khong dua UI vao trang thai kho hoc va kho chap nhan.",
        12.2,
        False,
        NAVY,
    )

    return prs


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    prs = build_deck()
    prs.save(str(OUT_PATH))
    print(f"Saved {OUT_PATH}")


if __name__ == "__main__":
    main()
