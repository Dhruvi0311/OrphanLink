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
            
            # If text is too short, it might be a scanned PDF
            if len(text.strip()) < 50:
                print("PDF text too short, falling back to OCR...")
                text = ""
                images = convert_from_bytes(file_bytes)
                for image in images:
                    text += pytesseract.image_to_string(image) + "\n"
                    
            return text.strip()
        except Exception as e:
            return f"Error parsing PDF: {e}"
            
    # Default to utf-8 decode
    try:
        return file_bytes.decode("utf-8")
    except Exception:
        return "Unsupported file format or decoding failed."
