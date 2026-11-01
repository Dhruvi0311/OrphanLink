import io
import json
import fitz  # PyMuPDF
from PIL import Image
import pytesseract
from pdf2image import convert_from_bytes

def parse_file(file_bytes: bytes, filename: str) -> str:
    # 1. Check if JSON
    if filename.endswith(".json"):
        try:
            data = json.loads(file_bytes.decode("utf-8"))
            return json.dumps(data, indent=2)
        except Exception as e:
            return f"Error parsing JSON: {e}"

    # 2. Check if TXT
    if filename.endswith(".txt"):
        try:
            return file_bytes.decode("utf-8")
        except Exception:
            pass

    # 3. Handle PDF
    if filename.endswith(".pdf"):
        text = ""
        try:
            # First try PyMuPDF for native text
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page in doc:
                text += page.get_text()
            
            # If text is too short, it is a scanned or image-based PDF
            if len(text.strip()) < 50:
                print("PDF native text too short, falling back to OCR...")
                ocr_text_parts = []
                # Use PyMuPDF page pixmap rendering (requires no poppler!)
                for page_idx in range(len(doc)):
                    page = doc[page_idx]
                    pix = page.get_pixmap()
                    img_bytes = pix.tobytes()
                    img = Image.open(io.BytesIO(img_bytes))
                    
                    # 1. Try RapidOCR (runs locally with onnxruntime)
                    try:
                        from rapidocr_onnxruntime import RapidOCR
                        rapid_ocr = RapidOCR()
                        ocr_res, _ = rapid_ocr(img_bytes)
                        if ocr_res:
                            page_text = "\n".join([line[1] for line in ocr_res])
                            ocr_text_parts.append(page_text)
                    except Exception as ocr_err:
                        print(f"RapidOCR attempt failed: {ocr_err}")
                        # 2. Fall back to pytesseract if installed
                        try:
                            tess_text = pytesseract.image_to_string(img)
                            if tess_text.strip():
                                ocr_text_parts.append(tess_text)
                        except Exception:
                            pass
                text = "\n".join(ocr_text_parts)
                    
            return text.strip()[:7500] # Truncate to prevent token limit errors
        except Exception as e:
            return f"Error parsing PDF: {e}"
            
    # Default to utf-8 decode
    try:
        return file_bytes.decode("utf-8")
    except Exception:
        return "Unsupported file format or decoding failed."
