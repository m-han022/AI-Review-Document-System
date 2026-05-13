import os
from PIL import Image, ImageDraw, ImageFont

def create_pdf():
    # Kích thước trang A4 (150 DPI)
    width, height = 1240, 1754
    margin = 100
    max_width = width - (margin * 2)

    # Thử load các font TrueType phổ biến trên Windows
    font_paths = [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
        r"C:\Windows\Fonts\segoeui.ttf"
    ]
    
    font_path = None
    for p in font_paths:
        if os.path.exists(p):
            font_path = p
            break
            
    if not font_path:
        print("Không tìm thấy font hệ thống hỗ trợ tiếng Việt. Dùng font mặc định.")
        font_title = ImageFont.load_default()
        font_heading = ImageFont.load_default()
        font_body = ImageFont.load_default()
        font_italic = ImageFont.load_default()
    else:
        font_title = ImageFont.truetype(font_path, 40)
        font_heading = ImageFont.truetype(font_path, 30)
        font_body = ImageFont.truetype(font_path, 22)
        font_italic = ImageFont.truetype(font_path, 18)

    def draw_wrapped_text(draw, text, font, x, y, max_w, fill=(0, 0, 0), line_spacing=10):
        lines = []
        paragraphs = text.split('\n')
        for para in paragraphs:
            if not para.strip():
                lines.append("")
                continue
            words = para.split(' ')
            current_line = words[0]
            for word in words[1:]:
                # Kiểm tra độ rộng khi thêm từ mới
                test_line = current_line + " " + word
                w = draw.textlength(test_line, font=font) if hasattr(draw, 'textlength') else font.getlength(test_line)
                if w <= max_w:
                    current_line = test_line
                else:
                    lines.append(current_line)
                    current_line = word
            lines.append(current_line)
            
        current_y = y
        for line in lines:
            if line:
                draw.text((x, current_y), line, font=font, fill=fill)
            # Tính chiều cao dòng
            # Dùng font.size hoặc giá trị ước lượng
            h = font.size if hasattr(font, 'size') else 20
            current_y += h + line_spacing
        return current_y

    pages = []

    # --- TRANG 1: TIÊU ĐỀ & ĐÁNH GIÁ TỔNG THỂ ---
    img1 = Image.new('RGB', (width, height), color='white')
    draw1 = ImageDraw.Draw(img1)
    
    y = margin
    # Tiêu đề chính
    draw1.text((margin, y), "BÁO CÁO NHÌN NHẬN DỰ ÁN", font=font_title, fill=(20, 50, 120))
    y += 60
    draw1.text((margin, y), "(PROJECT RETROSPECTIVE REVIEW)", font=font_heading, fill=(100, 100, 100))
    y += 80
    
    # Thông tin meta
    meta_text = "Mã dự án: P001\nTên dự án: Hệ thống Quản lý Bán hàng Trực tuyến\nGiai đoạn: Q1/2026\nNgười lập: Đội ngũ Phát triển"
    y = draw_wrapped_text(draw1, meta_text, font_body, margin, y, max_width, fill=(50, 50, 50), line_spacing=8)
    y += 60
    
    # Đường kẻ phân cách
    draw1.line([(margin, y), (width - margin, y)], fill=(200, 200, 200), width=2)
    y += 40
    
    # Phần 1: Đánh giá tổng thể
    draw1.text((margin, y), "1. ĐÁNH GIÁ TỔNG THỂ (OVERALL REVIEW)", font=font_heading, fill=(20, 50, 120))
    y += 50
    
    p1_content = (
        "Dự án đã hoàn thành các mốc thời gian cơ bản và bàn giao sản phẩm ban đầu cho khách hàng trải nghiệm. "
        "Tuy nhiên, trong quá trình thực hiện vẫn còn nhiều phát sinh về mặt yêu cầu nghiệp vụ và xuất hiện một số "
        "lỗi vặt ở giai đoạn kiểm thử UAT.\n\n"
        "Đội ngũ dự án đã làm việc chăm chỉ, nỗ lực bám sát tiến độ nhưng chưa tối ưu hóa được quy trình phối hợp "
        "và giao tiếp hiệu quả giữa bộ phận Phát triển (Dev) và bộ phận Kiểm thử (Tester)."
    )
    y = draw_wrapped_text(draw1, p1_content, font_body, margin, y, max_width, line_spacing=12)
    y += 40
    
    p1_note = "* Ghi chú bối cảnh hệ thống: Nội dung đánh giá tổng thể mang tính liệt kê tình hình, thiếu số liệu định lượng cụ thể (ngân sách, tỷ lệ hoàn thành, nỗ lực thực tế). Dự kiến đạt ~12/25 điểm."
    draw_wrapped_text(draw1, p1_note, font_italic, margin, y, max_width, fill=(150, 50, 50))
    
    pages.append(img1)

    # --- TRANG 2: ĐIỂM TỐT & ĐIỂM CẦN CẢI THIỆN ---
    img2 = Image.new('RGB', (width, height), color='white')
    draw2 = ImageDraw.Draw(img2)
    
    y = margin
    draw2.text((margin, y), "2. ĐIỂM TỐT / THÀNH CÔNG (STRENGTHS)", font=font_heading, fill=(20, 50, 120))
    y += 50
    
    p2_content = (
        "- Tinh thần trách nhiệm cao: Các thành viên trong đội dự án sẵn sàng làm thêm giờ (OT) để kịp tiến độ "
        "cho đợt phát hành (release) đầu tiên.\n"
        "- Tích hợp kỹ thuật: Thực hiện tích hợp thành công cổng thanh toán nội địa đúng thời hạn yêu cầu."
    )
    y = draw_wrapped_text(draw2, p2_content, font_body, margin, y, max_width, line_spacing=12)
    y += 30
    
    p2_note = "* Ghi chú bối cảnh: Nêu được điểm sáng nhưng minh chứng sơ sài, thiếu dẫn chứng cụ thể. Dự kiến đạt ~13/25 điểm."
    y = draw_wrapped_text(draw2, p2_note, font_italic, margin, y, max_width, fill=(150, 50, 50))
    y += 60
    
    draw2.line([(margin, y), (width - margin, y)], fill=(200, 200, 200), width=2)
    y += 40
    
    draw2.text((margin, y), "3. ĐIỂM CẦN CẢI THIỆN (WEAKNESSES / ISSUES)", font=font_heading, fill=(20, 50, 120))
    y += 50
    
    p3_content = (
        "- Số lượng lỗi (bug) phát hiện trong đợt kiểm thử tích hợp hệ thống (SIT) khá nhiều, gây chậm trễ 3 ngày "
        "so với kế hoạch ban đầu.\n"
        "- Tài liệu đặc tả yêu cầu (SRS) chưa được cập nhật kịp thời khi khách hàng có thay đổi về luồng nghiệp vụ."
    )
    y = draw_wrapped_text(draw2, p3_content, font_body, margin, y, max_width, line_spacing=12)
    y += 30
    
    p3_note = "* Ghi chú bối cảnh: Nêu được vấn đề nhưng THIẾU phân tích nguyên nhân gốc rễ (Root Cause) vì sao tài liệu chậm cập nhật hay vì sao nhiều lỗi. Dự kiến đạt ~15/30 điểm."
    draw_wrapped_text(draw2, p3_note, font_italic, margin, y, max_width, fill=(150, 50, 50))
    
    pages.append(img2)

    # --- TRANG 3: CHÍNH SÁCH CẢI THIỆN ---
    img3 = Image.new('RGB', (width, height), color='white')
    draw3 = ImageDraw.Draw(img3)
    
    y = margin
    draw3.text((margin, y), "4. CHÍNH SÁCH CẢI THIỆN (ACTION PLAN)", font=font_heading, fill=(20, 50, 120))
    y += 50
    
    p4_content = (
        "- Cần tổ chức các buổi họp Daily ngắn gọn và hiệu quả hơn để nắm bắt các trở ngại (blocker) kịp thời.\n"
        "- Yêu cầu phân tích viên (BA) cập nhật tài liệu đặc tả ngay khi có xác nhận thay đổi từ phía khách hàng.\n"
        "- Khuyến khích lập trình viên tự kiểm tra chéo và viết Unit Test trước khi bàn giao cho bộ phận QA."
    )
    y = draw_wrapped_text(draw3, p4_content, font_body, margin, y, max_width, line_spacing=12)
    y += 30
    
    p4_note = "* Ghi chú bối cảnh: Kế hoạch hành động chung chung, THIẾU chỉ số đo lường (KPI) và KHÔNG gán người chịu trách nhiệm (PIC) cũng như thời hạn (Deadline) cụ thể. Dự kiến đạt ~10/20 điểm."
    y = draw_wrapped_text(draw3, p4_note, font_italic, margin, y, max_width, fill=(150, 50, 50))
    y += 80
    
    # Tổng kết kịch bản
    draw3.line([(margin, y), (width - margin, y)], fill=(200, 200, 200), width=2)
    y += 40
    draw3.text((margin, y), "TỔNG ĐIỂM KỊCH BẢN DỰ KIẾN: 50 / 100 ĐIỂM", font=font_heading, fill=(50, 150, 50))
    
    pages.append(img3)

    # --- LƯU FILE PDF ---
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "P001-Nhin_nhan_du_an_50_diem.pdf")
    
    pages[0].save(
        output_path, "PDF",
        resolution=150.0,
        save_all=True,
        append_images=pages[1:]
    )
    print(f"Created PDF successfully at: {output_path}")

if __name__ == "__main__":
    create_pdf()
