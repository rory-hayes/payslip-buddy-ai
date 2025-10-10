from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from redis import Redis

from apps.api.auth import (
    AuthenticatedUser,
    get_current_user,
    require_internal_or_authenticated,
    require_internal_token,
)
from apps.common.config import get_settings
from apps.common.models import DossierChecklistItem, DossierMonth, DossierResponse, DossierTotals, JobKind, JobStatus
from apps.common.supabase import get_supabase
from apps.worker.celery_app import celery_app

app = FastAPI(title="Payslip Companion API", version="1.0.0")


@app.get("/healthz")
async def healthz() -> Dict[str, Any]:
    settings = get_settings()
    supabase = get_supabase().client
    try:
        supabase.table("jobs").select("id").limit(1).execute()
    except Exception as exc:  # pragma: no cover - connectivity failure path
        raise HTTPException(status_code=503, detail="Supabase unavailable") from exc
    try:
        redis_client = Redis.from_url(settings.redis_url)
        redis_client.ping()
    except Exception as exc:  # pragma: no cover - connectivity failure path
        raise HTTPException(status_code=503, detail="Redis unavailable") from exc
    return {"ok": True, "redis_url": settings.redis_url}


class TriggerJobPayload(BaseModel):
    user_id: str
    kind: JobKind
    file_id: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


@app.post("/internal/jobs/trigger", status_code=202)
async def trigger_job(payload: TriggerJobPayload, request: Request) -> Dict[str, Any]:
    require_internal_token(request)
    supabase = get_supabase()
    job = supabase.insert_row(
        "jobs",
        {
            "user_id": payload.user_id,
            "file_id": payload.file_id,
            "kind": payload.kind.value,
            "status": JobStatus.QUEUED.value,
            "meta": payload.meta,
        },
    )
    job_id = job.get("id")
    if job_id is None:  # pragma: no cover - defensive guard
        raise HTTPException(status_code=500, detail="Failed to enqueue job")
    celery_app.send_task(f"jobs.{payload.kind.value}", args=[job_id])
    return job


class UserJobPayload(BaseModel):
    kind: JobKind
    file_id: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


@app.post("/jobs", status_code=202)
async def create_user_job(
    payload: UserJobPayload, user: AuthenticatedUser = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create a new job for the authenticated user and dispatch its Celery task."""

    supabase = get_supabase()
    job = supabase.insert_row(
        "jobs",
        {
            "user_id": user.user_id,
            "file_id": payload.file_id,
            "kind": payload.kind.value,
            "status": JobStatus.QUEUED.value,
            "meta": payload.meta or {},
        },
    )
    job_id = job.get("id")
    if job_id is None:
        raise HTTPException(status_code=500, detail="Failed to create job")

    celery_app.send_task(f"jobs.{payload.kind.value}", args=[job_id])
    return job


@app.get("/internal/jobs/{job_id}")
async def get_job(
    job_id: str,
    _: Optional[AuthenticatedUser] = Depends(require_internal_or_authenticated),
) -> Dict[str, Any]:
    supabase = get_supabase()
    job = supabase.table_select_single("jobs", match={"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


class DossierPreviewResponse(BaseModel):
    totals: Dict[str, float]
    months: list[Dict[str, Any]]
    checklist: list[Dict[str, Any]]


def _aggregate_dossier(user_id: str, year: int) -> DossierResponse:
    supabase = get_supabase()
    response = supabase.rpc(
        "rpc_dossier_aggregate",
        {"p_user_id": user_id, "p_year": year},
    )
    totals = response.get("totals") or {}
    months = response.get("months") or []
    checklist_rows = response.get("checklist") or []
    dossier = DossierResponse(
        totals=DossierTotals(
            gross=float(totals.get("gross", 0.0)),
            net=float(totals.get("net", 0.0)),
            tax_income=float(totals.get("tax_income", 0.0)),
            ni_prsi=float(totals.get("ni_prsi", 0.0)),
            pension_employee=float(totals.get("pension_employee", 0.0)),
            pension_employer=float(totals.get("pension_employer", 0.0)),
        ),
        months=[
            DossierMonth(
                month=item.get("month", ""),
                gross=float(item.get("gross", 0.0)),
                net=float(item.get("net", 0.0)),
                tax_income=float(item.get("tax_income", 0.0)),
                ni_prsi=float(item.get("ni_prsi", 0.0)),
                pension_employee=float(item.get("pension_employee", 0.0)),
            )
            for item in months
        ],
        checklist=[
            DossierChecklistItem(
                title=item.get("title", ""),
                note=item.get("note", ""),
                link=item.get("link", ""),
            )
            for item in checklist_rows
        ],
    )
    return dossier


@app.get("/dossier/preview", response_model=DossierPreviewResponse)
async def dossier_preview(year: int, user: AuthenticatedUser = Depends(get_current_user)) -> Dict[str, Any]:
    dossier = _aggregate_dossier(user.user_id, year)
    return {
        "totals": dossier.totals.__dict__,
        "months": [month.__dict__ for month in dossier.months],
        "checklist": [item.__dict__ for item in dossier.checklist],
    }


@app.exception_handler(Exception)
async def generic_exception_handler(_: Request, exc: Exception) -> JSONResponse:  # pragma: no cover - fallback logging
    return JSONResponse(status_code=500, content={"detail": str(exc)})
