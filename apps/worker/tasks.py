from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from celery import shared_task

from apps.common.models import JobKind, JobStatus
from apps.common.supabase import get_supabase
from apps.worker.celery_app import celery_app
from apps.worker.services.merge import (
    LlmExtraction,
    NativeExtraction,
    infer_period_type,
    merge_native_with_llm,
    validate_identity_rule,
)
from apps.worker.services.anomalies import PayslipSnapshot, detect_anomalies


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


@shared_task(name="jobs.extract")
def job_extract(job_id: str) -> None:
    supabase = get_supabase()
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

    native = NativeExtraction(
        employer_name=None,
        pay_date=None,
        period_start=None,
        period_end=None,
        currency=None,
        country=None,
        gross=None,
        net=None,
        tax_income=None,
        ni_prsi=None,
        pension_employee=None,
        pension_employer=None,
        student_loan=None,
        other_deductions=None,
        ytd=None,
        tax_code=None,
    )
    llm_payload = {
        "country": "UK",
        "currency": "GBP",
        "gross": 0.0,
        "net": 0.0,
        "tax_income": 0.0,
        "ni_prsi": 0.0,
        "pension_employee": 0.0,
        "pension_employer": 0.0,
        "student_loan": 0.0,
        "other_deductions": [],
        "ytd": {},
        "confidence_overall": 0.0,
    }
    merged = merge_native_with_llm(native, LlmExtraction(payload=llm_payload))
    merged["period_type"] = infer_period_type(merged.get("period_start"), merged.get("period_end"))
    identity_ok = validate_identity_rule(merged)
    review_required = not identity_ok or merged.get("confidence_overall", 0.0) < 0.9

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
        "confidence_overall": merged.get("confidence_overall"),
        "review_required": review_required,
        "conflict": False,
        "explainer_text": "Automated extraction placeholder.",
    }
    payslip = supabase.insert_row("payslips", payslip_record)

    _append_event(job["user_id"], "extract_complete", {"payslip_id": payslip.get("id")})

    _update_job(
        job_id,
        {
            "status": JobStatus.NEEDS_REVIEW.value if review_required else JobStatus.DONE.value,
            "meta": {**(job.get("meta") or {}), "fields": merged, "reviewRequired": review_required},
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

    history_response = supabase.client.table("payslips").select("*").eq("user_id", job["user_id"]).lt("created_at", payslip["created_at"]).order("created_at", desc=True).limit(5).execute()
    history_rows = history_response.data or []
    history_snapshots = [
        PayslipSnapshot(
            payslip_id=row.get("id", ""),
            employer_name=row.get("employer_name", ""),
            net=float(row.get("net") or 0.0),
            pension_employee=float(row.get("pension_employee") or 0.0),
            tax_code=row.get("tax_code"),
            ytd=row.get("ytd") or {},
            pay_date=datetime.fromisoformat(row.get("pay_date")) if row.get("pay_date") else datetime.fromtimestamp(0, tz=timezone.utc),
            deductions={"other": float(row.get("other_deductions") or 0.0)},
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
        deductions={"other": float(payslip.get("other_deductions") or 0.0)},
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


@shared_task(name="jobs.generic")
def job_generic(job_id: str, kind: str) -> None:
    _update_job(job_id, {"status": JobStatus.DONE.value, "meta": {"placeholder": True, "kind": kind}})
