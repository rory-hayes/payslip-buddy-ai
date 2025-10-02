from __future__ import annotations

import io
import json
import logging
import zipfile
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List

from weasyprint import HTML

from pathlib import Path

from apps.common.supabase import get_supabase

try:
    import fitz
except Exception:  # pragma: no cover - optional dependency fallback
    fitz = None

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class ReportArtifact:
    filename: str
    bytes: bytes
    content_type: str


def _format_currency(value: Any) -> str:
    try:
        return f"£{float(value):,.2f}"
    except Exception:  # pragma: no cover
        return str(value)


def generate_dossier_pdf(user_id: str, dossier: Dict[str, Any]) -> ReportArtifact:
    html = _render_html("Employee Payslip Dossier", dossier)
    pdf_bytes = _write_pdf("Employee Payslip Dossier", html, dossier)
    return ReportArtifact(filename=f"{user_id}_dossier.pdf", bytes=pdf_bytes, content_type="application/pdf")


def generate_hr_pack_pdf(user_id: str, payload: Dict[str, Any]) -> ReportArtifact:
    html = _render_html("HR Summary Pack", payload)
    pdf_bytes = _write_pdf("HR Summary Pack", html, payload)
    return ReportArtifact(filename=f"{user_id}_hr_pack.pdf", bytes=pdf_bytes, content_type="application/pdf")


def _render_html(title: str, payload: Dict[str, Any]) -> str:
    body = json.dumps(payload, indent=2)
    template = f"""
    <html>
    <head><meta charset='utf-8'><title>{title}</title></head>
    <body>
        <h1>{title}</h1>
        <pre>{body}</pre>
    </body>
    </html>
    """
    return template


def _write_pdf(title: str, html: str, payload: Dict[str, Any]) -> bytes:
    try:
        return HTML(string=html).write_pdf()
    except TypeError as exc:  # pragma: no cover - compatibility path
        LOGGER.warning("WeasyPrint compatibility fallback: %s", exc)
    except Exception as exc:  # pragma: no cover - rendering failure path
        LOGGER.warning("WeasyPrint rendering failed: %s", exc)
    if fitz is not None:
        doc = fitz.open()
        page = doc.new_page()
        y = 50
        page.insert_text((50, y), title, fontsize=16)
        y += 24
        for line in json.dumps(payload, indent=2).splitlines():
            page.insert_text((50, y), line, fontsize=10)
            y += 14
        buffer = io.BytesIO()
        doc.save(buffer)
        return buffer.getvalue()
    return html.encode("utf-8")


def build_export_zip(user_id: str, *, payslips: List[Dict[str, Any]], files: List[Dict[str, Any]], anomalies: List[Dict[str, Any]], settings: Dict[str, Any]) -> ReportArtifact:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("payslips.json", json.dumps(payslips, indent=2, default=str))
        archive.writestr("anomalies.json", json.dumps(anomalies, indent=2, default=str))
        archive.writestr("settings.json", json.dumps(settings, indent=2, default=str))
        for file_row in files:
            key = file_row.get("s3_key_original") or file_row.get("storage_path")
            if not key:
                continue
            archive.writestr(f"pdfs/{Path(key).name}", "")
    return ReportArtifact(filename=f"{user_id}_export.zip", bytes=buf.getvalue(), content_type="application/zip")


def fetch_dossier_payload(user_id: str, year: int) -> Dict[str, Any]:
    supabase = get_supabase()
    response = supabase.rpc("rpc_dossier_aggregate", {"p_user_id": user_id, "p_year": year})
    return response or {}


__all__ = [
    "ReportArtifact",
    "generate_dossier_pdf",
    "generate_hr_pack_pdf",
    "build_export_zip",
    "fetch_dossier_payload",
]
