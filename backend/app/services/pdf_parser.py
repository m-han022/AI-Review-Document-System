from typing import List, Dict, Any
import io
import re
import pdfplumber
from pathlib import Path


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using pdfplumber for better multilingual support."""
    text_parts = []
    try:
        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"[PDF Extract] Detected {total_pages} pages")
            for page_num in range(1, total_pages + 1):
                try:
                    page = pdf.pages[page_num - 1]
                    page_text = page.extract_text() or ""
                    text_parts.append(f"[Page {page_num}]\n{page_text}")
                except Exception as e_page:
                    print(f"[PDF Extract] Error on page {page_num}: {e_page}")
                    text_parts.append(f"[Page {page_num}]\n[Extraction Failed]")
    except Exception as e:
        print(f"[PDF Extract] Error with pdfplumber: {e}")
        try:
            # Fallback to PyPDF2
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            for page_num, page in enumerate(reader.pages, 1):
                page_text = page.extract_text() or ""
                text_parts.append(f"[Page {page_num}]\n{page_text}")
        except Exception as e2:
            print(f"[PDF Extract] Error with PyPDF2: {e2}")
    return "\n\n".join(text_parts)


def extract_text_from_pptx(file_path: str) -> str:
    """Extract text from PowerPoint (.pptx) file with support for tables and grouped shapes."""
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE
    
    def get_shape_text(shape):
        texts = []
        if shape.has_text_frame:
            for paragraph in shape.text_frame.paragraphs:
                for run in paragraph.runs:
                    if run.text.strip():
                        texts.append(run.text.strip())
        
        if shape.has_table:
            for row in shape.table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        texts.append(cell.text.strip())
        
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            for s in shape.shapes:
                texts.extend(get_shape_text(s))
                
        return texts

    text_parts = []
    try:
        prs = Presentation(file_path)
        total_slides = len(prs.slides)
        print(f"[PPTX Extract] Detected {total_slides} slides")
        for slide_num, slide in enumerate(prs.slides, 1):
            slide_text = []
            for shape in slide.shapes:
                slide_text.extend(get_shape_text(shape))
            text_parts.append(f"[Slide {slide_num}]\n" + "\n".join(slide_text))
    except Exception as e:
        print(f"[PPTX Extract] Error extracting text: {e}")
        return ""
    
    return "\n\n".join(text_parts)


def extract_multimodal_from_pdf(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract text and render pages to images for PDF (Optimized).
    """
    import pypdfium2 as pdfium
    from PIL import Image
    
    results = []
    try:
        with pdfplumber.open(file_path) as pdf:
            doc = pdfium.PdfDocument(file_path)
            total_pages = len(pdf.pages)
            
            for i in range(total_pages):
                page_num = i + 1
                page_text = ""
                try:
                    page_text = pdf.pages[i].extract_text() or ""
                except:
                    pass
                
                page_images = []
                try:
                    page = doc[i]
                    bitmap = page.render(scale=1.2) # Optimized scale from 1.5 to 1.2 for faster rendering
                    pil_image = bitmap.to_pil()
                    
                    # Resize if too large
                    max_size = 1024
                    if max(pil_image.size) > max_size:
                        pil_image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                    
                    # Convert to JPEG bytes (much smaller than PNG)
                    img_byte_arr = io.BytesIO()
                    pil_image.convert("RGB").save(img_byte_arr, format='JPEG', quality=75)
                    page_images.append(img_byte_arr.getvalue())
                except Exception as e_img:
                    print(f"[Multimodal PDF] Error rendering page {page_num}: {e_img}")
                
                results.append({
                    "text": f"[Page {page_num}]\n{page_text}",
                    "images": page_images
                })
            doc.close()
    except Exception as e:
        print(f"[Multimodal PDF] Error: {e}")
        text = extract_text_from_pdf(file_path)
        return [{"text": text, "images": []}]
        
    return results


def extract_multimodal_from_pptx(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract text and embedded images from PPTX slides (Optimized).
    """
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE
    from PIL import Image
    
    results = []
    try:
        prs = Presentation(file_path)
        
        def get_shape_content(shape):
            texts = []
            images = []
            
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    for run in paragraph.runs:
                        if run.text.strip():
                            texts.append(run.text.strip())
            
            if shape.has_table:
                for row in shape.table.rows:
                    for cell in row.cells:
                        if cell.text.strip():
                            texts.append(cell.text.strip())
            
            if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                try:
                    # Optimize image before adding
                    img_data = shape.image.blob
                    with Image.open(io.BytesIO(img_data)) as pil_img:
                        # Resize if too large
                        max_size = 1024
                        if max(pil_img.size) > max_size:
                            pil_img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                        
                        # Convert to JPEG
                        out_io = io.BytesIO()
                        pil_img.convert("RGB").save(out_io, format='JPEG', quality=75)
                        images.append(out_io.getvalue())
                except:
                    pass
            
            if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                for s in shape.shapes:
                    t, i = get_shape_content(s)
                    texts.extend(t)
                    images.extend(i)
                    
            return texts, images

        for slide_num, slide in enumerate(prs.slides, 1):
            slide_texts = []
            slide_images = []
            for shape in slide.shapes:
                t, i = get_shape_content(shape)
                slide_texts.extend(t)
                slide_images.extend(i)
            
            results.append({
                "text": f"[Slide {slide_num}]\n" + "\n".join(slide_texts),
                "images": slide_images
            })
    except Exception as e:
        print(f"[Multimodal PPTX] Error: {e}")
        text = extract_text_from_pptx(file_path)
        return [{"text": text, "images": []}]
        
    return results


def extract_multimodal_content(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract multimodal content (text + images) from a file.
    """
    file_path_obj = Path(file_path)
    extension = file_path_obj.suffix.lower()
    
    if extension == '.pdf':
        return extract_multimodal_from_pdf(str(file_path))
    elif extension == '.pptx':
        return extract_multimodal_from_pptx(str(file_path))
    else:
        raise ValueError(f"Unsupported file format: {extension}")


def extract_text_from_file(file_path: str) -> str:
    """Extract text from either PDF or PowerPoint file."""
    file_path = Path(file_path)
    extension = file_path.suffix.lower()
    
    if extension == '.pdf':
        return extract_text_from_pdf(str(file_path))
    elif extension == '.pptx':
        return extract_text_from_pptx(str(file_path))
    else:
        raise ValueError(f"Unsupported file format: {extension}. Only PDF and PowerPoint (.pptx) are supported.")


def detect_language_from_text(text: str) -> str:
    """
    Detect language from text content using weighted scoring.
    Returns: 'vi' for Vietnamese, 'ja' for Japanese
    """
    text_length = len(text)
    if text_length == 0:
        return "ja"
    
    ja_chars = len(re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', text))
    vi_chars = len(re.findall(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]', text))
    ja_patterns = len(re.findall(r'\b(です|ます|した|ている|こと|もの|これ|それ|あれ|この|その|あの|は|が|を|に|へ|で|と|から|まで|より|も|や|など|か|ね|よ)\b', text))
    vi_patterns = len(re.findall(r'\b(của|là|các|và|cho|đã|được|không|này|nhưng|với|một|người|tôi|chúng|có|về|những|tại|để)\b', text, re.IGNORECASE))
    
    ja_ratio = ja_chars / text_length if text_length > 0 else 0
    vi_ratio = vi_chars / text_length if text_length > 0 else 0
    
    ja_score = (ja_chars * 0.4) + (ja_patterns * 10 * 0.3) + (ja_ratio * 1000 * 0.3)
    vi_score = (vi_chars * 0.4) + (vi_patterns * 10 * 0.3) + (vi_ratio * 1000 * 0.3)
    
    if ja_score > vi_score and ja_score > 50:
        detected = "ja"
    elif vi_score > ja_score and vi_score > 50:
        detected = "vi"
    elif ja_chars > 0 and vi_chars > 0:
        detected = "ja" if ja_ratio > vi_ratio else "vi"
    elif ja_chars > 10:
        detected = "ja"
    elif vi_chars > 10:
        detected = "vi"
    else:
        detected = "ja"
    
    return detected
