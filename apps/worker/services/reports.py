from __future__ import annotations

import base64
import csv
import io
import json
import logging
import zipfile
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from weasyprint import HTML

from pathlib import Path

from apps.common.supabase import get_supabase
from apps.worker.services.storage import StorageService, get_storage_service

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
    preview = payload.get("redacted_preview") if isinstance(payload, dict) else None
    rendered_payload = json.loads(json.dumps(payload)) if isinstance(payload, dict) else payload
    if isinstance(rendered_payload, dict) and preview:
        preview_copy = dict(preview)
        preview_copy.pop("image_data", None)
        rendered_payload["redacted_preview"] = preview_copy
    html = _render_html("HR Summary Pack", rendered_payload, preview=preview)
    pdf_bytes = _write_pdf("HR Summary Pack", html, payload)
    return ReportArtifact(filename=f"{user_id}_hr_pack.pdf", bytes=pdf_bytes, content_type="application/pdf")


def _render_html(
    title: str,
    payload: Dict[str, Any],
    *,
    preview: Optional[Dict[str, Any]] = None,
) -> str:
    body = json.dumps(payload, indent=2)
    preview_section = ""
    if preview and preview.get("url"):
        link = preview["url"]
        label = preview.get("label") or "Redacted Preview"
        image_html = ""
        image_data = preview.get("image_data")
        if image_data:
            image_html = (
                f"<img src='data:image/png;base64,{image_data}' alt='Redacted preview for {label}' "
                "style='max-width:480px;border:1px solid #ccc;padding:8px;border-radius:4px;' />"
            )
        preview_section = f"""
        <section>
            <h2>Redacted Preview</h2>
            <p><a href="{link}">Download redacted preview</a> for <strong>{label}</strong>.</p>
            {image_html}
        </section>
        """
    template = f"""
    <html>
    <head><meta charset='utf-8'><title>{title}</title></head>
    <body>
        <h1>{title}</h1>
        {preview_section}
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


def _dicts_to_csv(rows: List[Dict[str, Any]]) -> str:
    if not rows:
        return ""
    fieldnames = sorted({key for row in rows for key in row.keys()})
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow({field: row.get(field) for field in fieldnames})
    return buffer.getvalue()


def build_export_zip(
    user_id: str,
    *,
    payslips: List[Dict[str, Any]],
    files: List[Dict[str, Any]],
    anomalies: List[Dict[str, Any]],
    settings: Dict[str, Any],
    storage: Optional[StorageService] = None,
) -> ReportArtifact:
    storage_service = storage or get_storage_service()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("payslips.json", json.dumps(payslips, indent=2, default=str))
        archive.writestr("anomalies.json", json.dumps(anomalies, indent=2, default=str))
        archive.writestr("settings.json", json.dumps(settings, indent=2, default=str))
        archive.writestr("payslips.csv", _dicts_to_csv(payslips))
        archive.writestr("files.csv", _dicts_to_csv(files))
        archive.writestr("anomalies.csv", _dicts_to_csv(anomalies))
        archive.writestr("settings.csv", _dicts_to_csv([settings] if settings else []))
        for file_row in files:
            file_id = file_row.get("id")
            if not file_id:
                continue
            try:
                pdf_object = storage_service.download_pdf(user_id=user_id, file_id=str(file_id))
            except FileNotFoundError:
                LOGGER.warning("Original PDF missing for export", extra={"user_id": user_id, "file_id": file_id})
                continue
            archive.writestr(f"pdfs/{file_id}.pdf", pdf_object.bytes)
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
