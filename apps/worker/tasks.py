from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from celery import shared_task

from apps.common.config import get_settings
from apps.common.models import JobKind, JobStatus
from apps.common.supabase import get_supabase
from apps.worker.celery_app import celery_app
from apps.worker.services.anomalies import PayslipSnapshot, detect_anomalies
from apps.worker.services.antivirus import AntivirusError, scan_bytes
from apps.worker.services.cleanup import delete_user_data, retention_cleanup
from apps.worker.services.llm import LlmResponse, LlmVisionClient, SpendCapExceeded
from apps.worker.services.merge import (
    LlmExtraction,
    NativeExtraction,
    infer_period_type,
    merge_native_with_llm,
    normalize_date,
    validate_identity_rule,
)
from apps.worker.services.pdf import (
    PdfText,
    decrypt_pdf,
    extract_kv_pairs,
    extract_text,
    guess_country,
    guess_currency,
    perform_ocr,
    rasterize_first_pages,
)
from apps.worker.services.redaction import redact_text
from apps.worker.services.reports import (
    build_export_zip,
    fetch_dossier_payload,
    generate_dossier_pdf,
    generate_hr_pack_pdf,
)
from apps.worker.services.storage import StorageObject, StorageService, get_storage_service
from apps.worker.services.validation import (
    calculate_confidence,
    count_native_fields,
    validate_date_window,
    validate_tax_code_format,
    validate_ytd_monotonic,
)

LOGGER = logging.getLogger(__name__)


def _update_job(job_id: str, updates: Dict[str, Any]) -> None:
    supabase = get_supabase()
    supabase.update_row("jobs", match={"id": job_id}, updates=updates)


def _append_event(user_id: str, event_type: str, payload: Dict[str, Any]) -> None:
    supabase = get_supabase()
    supabase.insert_row(
        "events",
        {
            "user_id": user_id,
            "type": event_type,
            "payload": payload,
        },
    )


def _record_redactions(user_id: str, file_id: str, boxes: List[Dict[str, float]]) -> None:
    supabase = get_supabase()
    supabase.insert_row(
        "redactions",
        {
            "user_id": user_id,
            "file_id": file_id,
            "boxes": boxes,
        },
    )


def _ensure_storage_service() -> StorageService:
    return get_storage_service()


def _native_parse(text: PdfText) -> NativeExtraction:
    kvs = extract_kv_pairs(text.raw_text)
    native = NativeExtraction(
        employer_name=None,
        pay_date=None,
        period_start=None,
        period_end=None,
        currency=guess_currency(text.raw_text),
        country=guess_country(text.raw_text),
        gross=kvs.get("gross"),
        net=kvs.get("net"),
        tax_income=kvs.get("tax_income"),
        ni_prsi=kvs.get("ni_prsi"),
        pension_employee=kvs.get("pension_employee"),
        pension_employer=None,
        student_loan=kvs.get("student_loan"),
        other_deductions=None,
        ytd={},
        tax_code=None,
    )
    return native


def _merge_pdf_text(primary: PdfText, secondary: PdfText) -> PdfText:
    parts = [primary.raw_text.strip(), secondary.raw_text.strip()]
    merged = "\n".join(part for part in parts if part)
    return PdfText(raw_text=merged, has_text=bool(merged.strip()))


def _augment_native(primary: NativeExtraction, fallback: NativeExtraction) -> NativeExtraction:
    for field in primary.__dataclass_fields__:
        current = getattr(primary, field)
        replacement = getattr(fallback, field)
        if current in (None, "") and replacement not in (None, ""):
            setattr(primary, field, replacement)
    if not primary.ytd and fallback.ytd:
        primary.ytd = fallback.ytd
    return primary


def _needs_ocr(native: NativeExtraction, text: PdfText) -> bool:
    if not text.has_text:
        return True
    return count_native_fields(native) < 4


def _percentify_boxes(boxes: List[Dict[str, float]]) -> List[Dict[str, float]]:
    percent_boxes: List[Dict[str, float]] = []
    for box in boxes:
        percent_box = dict(box)
        for key in ("x", "y", "w", "h"):
            value = percent_box.get(key, 0)
            if value is None:
                continue
            if value <= 1:
                value = value * 100
            value = max(0.0, min(float(value), 100.0))
            percent_box[key] = round(value, 4)
        percent_boxes.append(percent_box)
    return percent_boxes


def _llm_extract(
    user_id: str,
    file_id: Optional[str],
    redacted_previews: List[StorageObject],
) -> Optional[LlmResponse]:
    settings = get_settings()
    if not settings.openai_api_key:
        LOGGER.info("OpenAI API key missing; skipping LLM extraction")
        return None
    redacted_images = [preview.bytes for preview in redacted_previews]
    LOGGER.info(
        "Sending redacted previews to LLM",
        extra={
            "user_id": user_id,
            "file_id": file_id,
            "previews": [preview.path for preview in redacted_previews],
        },
    )
    try:
        client = LlmVisionClient()
        return client.infer(user_id=user_id, file_id=file_id, redacted_images=redacted_images)
    except SpendCapExceeded as exc:
        LOGGER.warning("LLM spend cap reached: %s", exc)
        _append_event(user_id, "llm_cap_reached", {"message": str(exc)})
        return None
    except Exception as exc:  # pragma: no cover - network failure path
        LOGGER.exception("LLM inference failed: %s", exc)
        _append_event(user_id, "llm_error", {"message": str(exc)})
        return None


@shared_task(name="jobs.extract")
def job_extract(job_id: str) -> None:
    supabase = get_supabase()
    storage = _ensure_storage_service()
    job = supabase.table_select_single("jobs", match={"id": job_id})
    if not job:
        return
    if job.get("status") not in {JobStatus.QUEUED.value, JobStatus.RUNNING.value}:
        return
    _update_job(job_id, {"status": JobStatus.RUNNING.value, "updated_at": datetime.now(timezone.utc).isoformat()})

    file_row = supabase.table_select_single("files", match={"id": job.get("file_id")})
    if not file_row:
        _update_job(job_id, {"status": JobStatus.FAILED.value, "error": "File not found"})
        return

    pdf_password = (job.get("meta") or {}).get("pdfPassword")

    try:
        storage_object = storage.download_pdf(user_id=job["user_id"], file_id=file_row["id"], password=pdf_password)
        scan_bytes(storage_object.bytes)
        decrypted_pdf = decrypt_pdf(storage_object.bytes, pdf_password)
        text = extract_text(decrypted_pdf)
        native = _native_parse(text)
        ocr_text = PdfText(raw_text="", has_text=False)
        used_ocr = False
        if _needs_ocr(native, text):
            LOGGER.info("Falling back to OCR for job %s", job_id)
            ocr_text = perform_ocr(decrypted_pdf, page_limit=2)
            if ocr_text.has_text:
                native = _augment_native(native, _native_parse(ocr_text))
                text = _merge_pdf_text(text, ocr_text)
                used_ocr = True
        redaction = redact_text(text.raw_text)
        percent_boxes = _percentify_boxes(redaction.boxes)
        rasterized = rasterize_first_pages(decrypted_pdf, pages=2)
        preview_image = redaction.preview_png or rasterized[0].png_bytes
        preview_artifact = storage.upload_bytes(
            user_id=job["user_id"],
            name=f"{file_row['id']}_redacted.png",
            content_type="image/png",
            data=preview_image,
        )
        supabase.update_row(
            "files",
            match={"id": file_row["id"]},
            updates={"s3_key_redacted": preview_artifact.path},
        )
        _record_redactions(job["user_id"], file_row["id"], percent_boxes)
        disable_llm = (job.get("meta") or {}).get("disable_llm")
        llm_response = None
        if not disable_llm:
            llm_response = _llm_extract(job["user_id"], job.get("file_id"), [preview_artifact])
    except AntivirusError as exc:
        _update_job(job_id, {"status": JobStatus.FAILED.value, "error": f"Antivirus detected threat: {exc}"})
        return
    except FileNotFoundError:
        _update_job(job_id, {"status": JobStatus.FAILED.value, "error": "PDF missing"})
        return
    except Exception as exc:  # pragma: no cover - fallback path
        LOGGER.exception("Extraction failure: %s", exc)
        _update_job(job_id, {"status": JobStatus.FAILED.value, "error": str(exc)})
        return

    llm_payload = llm_response.payload if llm_response else {
        "country": native.country or "UK",
        "currency": native.currency or "GBP",
        "gross": native.gross or 0.0,
        "net": native.net or 0.0,
        "tax_income": native.tax_income or 0.0,
        "ni_prsi": native.ni_prsi or 0.0,
        "pension_employee": native.pension_employee or 0.0,
        "pension_employer": 0.0,
        "student_loan": native.student_loan or 0.0,
        "other_deductions": [],
        "ytd": native.ytd or {},
        "tax_code": native.tax_code,
        "confidence_overall": 0.4,
    }

    merged = merge_native_with_llm(native, LlmExtraction(payload=llm_payload))
    merged["period_type"] = infer_period_type(merged.get("period_start"), merged.get("period_end"))
    merged["pay_date"] = normalize_date(merged.get("pay_date"))
    merged["period_start"] = normalize_date(merged.get("period_start"))
    merged["period_end"] = normalize_date(merged.get("period_end"))

    previous_rows = (
        supabase.client.table("payslips")
        .select("*")
        .eq("user_id", job["user_id"])
        .order("pay_date", desc=True)
        .limit(1)
        .execute()
    )
    previous_ytd = ((previous_rows.data or [{}])[0]).get("ytd") if previous_rows.data else None

    identity_ok = validate_identity_rule(merged)
    ytd_ok = validate_ytd_monotonic(merged.get("ytd") or {}, previous_ytd)
    dates_ok = validate_date_window(merged.get("pay_date"), merged.get("period_start"), merged.get("period_end"))
    tax_ok = validate_tax_code_format(merged.get("tax_code"), merged.get("country"))
    validations = {
        "identity": identity_ok,
        "ytd": ytd_ok,
        "dates": dates_ok,
        "tax": tax_ok,
    }
    confidence = calculate_confidence(
        native,
        merged,
        identity_ok=identity_ok,
        validations=validations,
        used_ocr=used_ocr,
        llm_present=bool(llm_response),
    )
    merged["confidence_overall"] = confidence
    review_required = not all(validations.values()) or confidence < 0.9

    payslip_record = {
        "user_id": job["user_id"],
        "file_id": job.get("file_id"),
        "employer_name": merged.get("employer_name"),
        "pay_date": merged.get("pay_date"),
        "period_start": merged.get("period_start"),
        "period_end": merged.get("period_end"),
        "period_type": merged.get("period_type"),
        "country": merged.get("country"),
        "currency": merged.get("currency"),
        "gross": merged.get("gross"),
        "net": merged.get("net"),
        "tax_income": merged.get("tax_income"),
        "ni_prsi": merged.get("ni_prsi"),
        "pension_employee": merged.get("pension_employee"),
        "pension_employer": merged.get("pension_employer"),
        "student_loan": merged.get("student_loan"),
        "other_deductions": merged.get("other_deductions"),
        "ytd": merged.get("ytd"),
        "tax_code": merged.get("tax_code"),
        "confidence_overall": confidence,
        "review_required": review_required,
        "conflict": False,
        "explainer_text": "Automated extraction with native+vision merge.",
    }
    payslip = supabase.insert_row("payslips", payslip_record)

    job_meta = job.get("meta") or {}
    job_meta.update(
        {
            "fields": merged,
            "confidence": confidence,
            "reviewRequired": review_required,
            "imageUrl": preview_artifact.path,
            "highlights": percent_boxes,
            "validations": validations,
            "ocrFallback": used_ocr,
        }
    )
    if llm_response:
        job_meta["llm"] = {"tokens": llm_response.tokens, "cost": llm_response.cost}
    if (job.get("meta") or {}).get("disable_llm"):
        job_meta["llmDisabled"] = True

    _append_event(job["user_id"], "extract_complete", {"payslip_id": payslip.get("id"), "identity_ok": identity_ok})

    _update_job(
        job_id,
        {
            "status": JobStatus.NEEDS_REVIEW.value if review_required else JobStatus.DONE.value,
            "meta": job_meta,
        },
    )

    follow_up = supabase.insert_row(
        "jobs",
        {
            "user_id": job["user_id"],
            "file_id": job.get("file_id"),
            "kind": JobKind.DETECT_ANOMALIES.value,
            "status": JobStatus.QUEUED.value,
            "meta": {},
        },
    )
    celery_app.send_task("jobs.detect_anomalies", args=[follow_up["id"]])


@shared_task(name="jobs.detect_anomalies")
def job_detect_anomalies(job_id: str) -> None:
    supabase = get_supabase()
    job = supabase.table_select_single("jobs", match={"id": job_id})
    if not job:
        return
    _update_job(job_id, {"status": JobStatus.RUNNING.value})
    payslip = supabase.table_select_single("payslips", match={"file_id": job.get("file_id")})
    if not payslip:
        _update_job(job_id, {"status": JobStatus.FAILED.value, "error": "Payslip missing"})
        return

    history_response = (
        supabase.client.table("payslips")
        .select("*")
        .eq("user_id", job["user_id"])
        .lt("created_at", payslip["created_at"])
        .order("created_at", desc=True)
        .limit(6)
        .execute()
    )
    history_rows = history_response.data or []
    history_snapshots = [
        PayslipSnapshot(
            payslip_id=row.get("id", ""),
            employer_name=row.get("employer_name") or "",
            net=float(row.get("net") or 0.0),
            pension_employee=float(row.get("pension_employee") or 0.0),
            tax_code=row.get("tax_code"),
            ytd=row.get("ytd") or {},
            pay_date=datetime.fromisoformat(row.get("pay_date")) if row.get("pay_date") else datetime.fromtimestamp(0, tz=timezone.utc),
            deductions={label: amount for label, amount in (row.get("other_deductions") or {}).items()} if isinstance(row.get("other_deductions"), dict) else {"other": float(row.get("other_deductions") or 0.0)},
        )
        for row in history_rows
    ]
    current_snapshot = PayslipSnapshot(
        payslip_id=payslip.get("id", ""),
        employer_name=payslip.get("employer_name") or "",
        net=float(payslip.get("net") or 0.0),
        pension_employee=float(payslip.get("pension_employee") or 0.0),
        tax_code=payslip.get("tax_code"),
        ytd=payslip.get("ytd") or {},
        pay_date=datetime.fromisoformat(payslip.get("pay_date")) if payslip.get("pay_date") else datetime.fromtimestamp(0, tz=timezone.utc),
        deductions={label: amount for label, amount in (payslip.get("other_deductions") or {}).items()} if isinstance(payslip.get("other_deductions"), dict) else {"other": float(payslip.get("other_deductions") or 0.0)},
    )
    anomalies = detect_anomalies(current_snapshot, history_snapshots)
    for anomaly in anomalies:
        supabase.insert_row(
            "anomalies",
            {
                "user_id": job["user_id"],
                "payslip_id": payslip.get("id"),
                "type": anomaly.type,
                "severity": anomaly.severity,
                "message": anomaly.message,
            },
        )
    _update_job(job_id, {"status": JobStatus.DONE.value, "meta": {"count": len(anomalies)}})


@shared_task(name="jobs.dossier")
def job_dossier(job_id: str) -> None:
    supabase = get_supabase()
    storage = _ensure_storage_service()
    job = supabase.table_select_single("jobs", match={"id": job_id})
    if not job:
        return
    _update_job(job_id, {"status": JobStatus.RUNNING.value})
    year = (job.get("meta") or {}).get("year") or datetime.now(timezone.utc).year
    payload = fetch_dossier_payload(job["user_id"], int(year))
    artifact = generate_dossier_pdf(job["user_id"], payload)
    stored = storage.upload_bytes(user_id=job["user_id"], name=artifact.filename, content_type=artifact.content_type, data=artifact.bytes)
    job_meta = job.get("meta") or {}
    job_meta["download_url"] = stored.path
    _update_job(job_id, {"status": JobStatus.DONE.value, "meta": job_meta})


@shared_task(name="jobs.hr_pack")
def job_hr_pack(job_id: str) -> None:
    supabase = get_supabase()
    storage = _ensure_storage_service()
    job = supabase.table_select_single("jobs", match={"id": job_id})
    if not job:
        return
    _update_job(job_id, {"status": JobStatus.RUNNING.value})
    payload = (job.get("meta") or {}).get("payload") or {}
    artifact = generate_hr_pack_pdf(job["user_id"], payload)
    stored = storage.upload_bytes(user_id=job["user_id"], name=artifact.filename, content_type=artifact.content_type, data=artifact.bytes)
    job_meta = job.get("meta") or {}
    job_meta["download_url"] = stored.path
    _update_job(job_id, {"status": JobStatus.DONE.value, "meta": job_meta})


@shared_task(name="jobs.export_all")
def job_export_all(job_id: str) -> None:
    supabase = get_supabase()
    storage = _ensure_storage_service()
    job = supabase.table_select_single("jobs", match={"id": job_id})
    if not job:
        return
    _update_job(job_id, {"status": JobStatus.RUNNING.value})
    payslips = (
        supabase.client.table("payslips").select("*").eq("user_id", job["user_id"]).execute().data or []
    )
    files = supabase.client.table("files").select("*").eq("user_id", job["user_id"]).execute().data or []
    anomalies = (
        supabase.client.table("anomalies").select("*").eq("user_id", job["user_id"]).execute().data or []
    )
    settings = (
        supabase.client.table("settings").select("*").eq("user_id", job["user_id"]).execute().data or []
    )
    artifact = build_export_zip(job["user_id"], payslips=payslips, files=files, anomalies=anomalies, settings=settings[0] if settings else {})
    stored = storage.upload_bytes(user_id=job["user_id"], name=artifact.filename, content_type=artifact.content_type, data=artifact.bytes)
    job_meta = job.get("meta") or {}
    job_meta["download_url"] = stored.path
    _update_job(job_id, {"status": JobStatus.DONE.value, "meta": job_meta})


@shared_task(name="jobs.delete_all")
def job_delete_all(job_id: str, purge_all: bool = False) -> None:
    supabase = get_supabase()
    job = supabase.table_select_single("jobs", match={"id": job_id})
    if not job:
        return
    _update_job(job_id, {"status": JobStatus.RUNNING.value})
    delete_user_data(job["user_id"], purge_all=purge_all or bool((job.get("meta") or {}).get("purge_all")))
    _update_job(job_id, {"status": JobStatus.DONE.value, "meta": job.get("meta") or {}})


@shared_task(name="cron.retention_cleanup")
def job_retention_cleanup() -> None:
    counts = retention_cleanup()
    for user_id, removed in counts.items():
        _append_event(user_id, "retention_cleanup", {"removed": removed})


@shared_task(name="jobs.generic")
def job_generic(job_id: str, kind: str) -> None:
    _update_job(job_id, {"status": JobStatus.DONE.value, "meta": {"placeholder": True, "kind": kind}})
