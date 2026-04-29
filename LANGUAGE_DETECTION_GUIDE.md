# 🌐 Giải pháp phát hiện ngôn ngữ cho tài liệu hỗn hợp

## 📋 Vấn đề

**Thực tế**: File tiếng Việt nhưng có lẫn tiếng Nhật
- Tên công ty Nhật: 株式会社ABC
- Thuật ngữ chuyên ngành: レビュー, 開発, テスト
- Email signature tiếng Nhật
- Copy-paste từ tài liệu Nhật

**Vấn đề cũ**: Chỉ cần 5 ký tự Nhật → detect là JA (SAI!)

---

## ✅ Giải pháp: Weighted Scoring System

### 🎯 Nguyên lý hoạt động

Thay vì đếm đơn thuần, hệ thống tính **điểm số tổng hợp** dựa trên 3 yếu tố:

| Yếu tố | Trọng số | Mô tả |
|--------|----------|-------|
| **Số ký tự** | 40% | Count characters đặc trưng |
| **Pattern** | 30% | Từ/cụm từ đặc trưng |
| **Tỷ lệ %** | 30% | Ratio so với tổng text |

### 📊 Công thức tính điểm

```python
ja_score = (ja_chars * 0.4) + (ja_patterns * 10 * 0.3) + (ja_ratio * 1000 * 0.3)
vi_score = (vi_chars * 0.4) + (vi_patterns * 10 * 0.3) + (vi_ratio * 1000 * 0.3)
```

### 🔍 Ví dụ thực tế

**File tiếng Việt có 34 ký tự Nhật + 46 ký tự Việt:**

```
JA chars: 34 (10.69%)
VI chars: 46 (14.47%)
JA patterns: 0
VI patterns: 3

JA score: 45.68
VI score: 70.80  ← CAO HƠN!

→ Detected: VI ✅
```

---

## 🧪 Kết quả test

### Test 1: Pure Vietnamese
```
✅ Expected: vi | Detected: vi
VI score: 89.95 vs JA score: 0.00
```

### Test 2: Pure Japanese
```
✅ Expected: ja | Detected: ja
JA score: 273.59 vs VI score: 0.00
```

### Test 3: Vietnamese + Japanese terms ⭐
```
✅ Expected: vi | Detected: vi
Content: "Báo cáo dự án - 株式会社ABC"
         "Giảm 20% thời gian 開発"
         
VI score: 70.80 vs JA score: 45.68
→ Correctly detected as Vietnamese!
```

### Test 4: Japanese + Vietnamese terms
```
✅ Expected: ja | Detected: ja
Content: "プロジェクト報告書 - ベトナムチーム"
         "Đội ngũ đã hoàn thành tốt"
         
JA score: 88.73 vs VI score: 52.58
→ Correctly detected as Japanese!
```

### Test 5: Vietnamese + Japanese signature ⭐
```
✅ Expected: vi | Detected: vi
Content: Email body tiếng Việt
         Signature: 株式会社ABC ベトナム支店
         
VI score: 46.33 vs JA score: 38.13
→ Correctly detected as Vietnamese!
```

---

## 🎨 Logic quyết định

```python
if ja_score > vi_score and ja_score > 50:
    detected = "ja"  # Japanese dominant
elif vi_score > ja_score and vi_score > 50:
    detected = "vi"  # Vietnamese dominant
elif ja_chars > 0 and vi_chars > 0:
    # Mixed content - use ratio
    detected = "ja" if ja_ratio > vi_ratio else "vi"
elif ja_chars > 10:
    detected = "ja"  # Fallback
elif vi_chars > 10:
    detected = "vi"  # Fallback
else:
    detected = "ja"  # Default
```

---

## 💡 Ưu điểm của giải pháp

### 1. **Chính xác hơn**
- Không bị lừa bởi vài ký tự Nhật trong text Việt
- Xét tổng thể cả document, không chỉ count đơn thuần

### 2. **Linh hoạt**
- Xử lý được mixed content
- Có threshold (50 points) để tránh false positive

### 3. **Dễ debug**
- Log chi tiết scores
- Dễ dàng tune weights nếu cần

### 4. **Realistic**
- Phù hợp với thực tế tài liệu doanh nghiệp
- Xử lý được email signatures, company names

---

## 🔧 Cách điều chỉnh (nếu cần)

### Tăng độ nhạy tiếng Việt:
```python
# Tăng weight cho Vietnamese patterns
vi_score = (vi_chars * 0.4) + (vi_patterns * 15 * 0.3) + (vi_ratio * 1000 * 0.3)
```

### Giảm threshold:
```python
# Từ 50 xuống 30
if vi_score > ja_score and vi_score > 30:
    detected = "vi"
```

### Thêm patterns:
```python
# Thêm từ đặc trưng tiếng Việt
vi_patterns = len(re.findall(
    r'\b(của|là|các|và|cho|đã|được|không|này|nhưng|với|một|người|tôi|chúng|có|về|những|tại|để|trong|trên|dưới|sau|trước)\b',
    text, re.IGNORECASE
))
```

---

## 📝 Best Practices

### 1. **Khi upload file**
- Hệ thống tự động detect → Không cần manual select
- Log sẽ hiển thị scores → Dễ debug nếu sai

### 2. **Nếu phát hiện sai**
- Check logs: `[Language Detection] JA score: XX, VI score: YY`
- Điều chỉnh weights trong `pdf_parser.py`
- Re-grade project

### 3. **Trường hợp đặc biệt**
- File song ngữ 50/50 → Sẽ detect theo ratio
- File quá ngắn (<100 chars) → Default to Japanese
- File toàn English → Default to Japanese

---

## 🎯 Kết luận

**Giải pháp Weighted Scoring** giúp:
- ✅ Phát hiện chính xác ngôn ngữ chính của tài liệu
- ✅ Không bị ảnh hưởng bởi từ/cụm từ ngôn ngữ khác
- ✅ Phù hợp với thực tế tài liệu doanh nghiệp Việt-Nhật
- ✅ Dễ maintain và tune

**Đã test và hoạt động tốt với 7 scenarios khác nhau!**

---

## 📚 Files liên quan

- [backend/app/services/pdf_parser.py](backend/app/services/pdf_parser.py) - Logic detection
- [test_language_detection.py](test_language_detection.py) - Test cases
- [backend/app/routers/upload.py](backend/app/routers/upload.py) - Upload endpoint
