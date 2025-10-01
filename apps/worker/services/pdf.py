from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

from PIL import Image, ImageDraw, ImageFont

try:
    import fitz  # PyMuPDF
except Exception:  # pragma: no cover - optional dependency
    fitz = None

try:
    import pdfplumber
except Exception:  # pragma: no cover - optional dependency
    pdfplumber = None

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class PdfText:
    raw_text: str
    has_text: bool


@dataclass(slots=True)
class RasterizedPage:
    index: int
    png_bytes: bytes


def decrypt_pdf(data: bytes, password: Optional[str]) -> bytes:
    if not password:
        return data
    if fitz is None:
        LOGGER.warning("PyMuPDF unavailable; returning encrypted payload as-is.")
        return data
    doc = fitz.open(stream=data, filetype="pdf")
    if not doc.needs_pass:
        return data
    if not doc.authenticate(password):  # pragma: no cover - invalid password path
        raise ValueError("Invalid PDF password")
    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def extract_text(data: bytes) -> PdfText:
    if pdfplumber is None:
        LOGGER.warning("pdfplumber unavailable; returning empty text")
        return PdfText(raw_text="", has_text=False)
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        texts: List[str] = []
        for page in pdf.pages:
            text = page.extract_text() or ""
            texts.append(text)
        raw_text = "\n".join(texts)
        has_text = any(text.strip() for text in texts)
        return PdfText(raw_text=raw_text, has_text=has_text)


def rasterize_first_pages(data: bytes, *, dpi: int = 300, pages: int = 2) -> List[RasterizedPage]:
    results: List[RasterizedPage] = []
    if fitz is None:
        LOGGER.warning("PyMuPDF unavailable; returning placeholder rasterization")
        placeholder = _placeholder_image("Preview unavailable")
        results.append(RasterizedPage(index=0, png_bytes=placeholder))
        return results
    doc = fitz.open(stream=data, filetype="pdf")
    for i, page in enumerate(doc):
        if i >= pages:
            break
        pix = page.get_pixmap(dpi=dpi)
        results.append(RasterizedPage(index=i, png_bytes=pix.tobytes("png")))
    if not results:
        results.append(RasterizedPage(index=0, png_bytes=_placeholder_image("Empty PDF")))
    return results


def _placeholder_image(text: str) -> bytes:
    img = Image.new("RGB", (900, 1200), color="white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 24)
    except Exception:  # pragma: no cover - fallback
        font = ImageFont.load_default()
    draw.text((50, 600), text, fill="black", font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def render_redacted_preview(redacted_text: str) -> bytes:
    wrapped = "\n".join(_wrap_text(redacted_text))
    return _placeholder_image(wrapped[:4000])


def _wrap_text(text: str, width: int = 70) -> Iterable[str]:
    line: List[str] = []
    count = 0
    for token in text.split():
        if count + len(token) + 1 > width:
            yield " ".join(line)
            line = [token]
            count = len(token) + 1
        else:
            line.append(token)
            count += len(token) + 1
    if line:
        yield " ".join(line)


def guess_currency(raw_text: str) -> Optional[str]:
    if "€" in raw_text or " EUR" in raw_text.upper():
        return "EUR"
    if "£" in raw_text or " GBP" in raw_text.upper():
        return "GBP"
    return None


def guess_country(raw_text: str) -> Optional[str]:
    text_upper = raw_text.upper()
    if "HMRC" in text_upper or "NI NUMBER" in text_upper:
        return "UK"
    if "PPS" in text_upper or "PRSI" in text_upper:
        return "IE"
    return None


def parse_amount(token: str) -> Optional[float]:
    token = token.replace(",", "").replace("£", "").replace("€", "")
    try:
        return round(float(token), 2)
    except ValueError:
        return None


def extract_kv_pairs(raw_text: str) -> Dict[str, float]:
    keys = {
        "gross": ["gross pay", "gross", "total gross"],
        "net": ["net pay", "take home", "net"],
        "tax_income": ["tax", "income tax"],
        "ni_prsi": ["ni", "national insurance", "prsi"],
        "pension_employee": ["pension", "employee pension"],
        "student_loan": ["student loan"],
    }
    lowered = raw_text.lower()
    lines = lowered.splitlines()
    results: Dict[str, float] = {}
    for key, hints in keys.items():
        for line in lines:
            if key in results:
                break
            if any(hint in line for hint in hints):
                parts = line.split()
                for token in reversed(parts):
                    amount = parse_amount(token)
                    if amount is not None:
                        results[key] = amount
                        break
    return results


__all__ = [
    "PdfText",
    "RasterizedPage",
    "decrypt_pdf",
    "extract_text",
    "rasterize_first_pages",
    "render_redacted_preview",
    "guess_currency",
    "guess_country",
    "extract_kv_pairs",
]
