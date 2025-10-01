from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional


class JobKind(str, Enum):
    EXTRACT = "extract"
    DETECT_ANOMALIES = "detect_anomalies"
    HR_PACK = "hr_pack"
    DOSSIER = "dossier"
    DELETE_ALL = "delete_all"
    EXPORT_ALL = "export_all"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    NEEDS_REVIEW = "needs_review"
    DONE = "done"
    FAILED = "failed"


@dataclass(slots=True)
class Job:
    id: str
    user_id: str
    kind: JobKind
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    file_id: Optional[str] = None
    error: Optional[str] = None
    meta: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class Payslip:
    id: str
    user_id: str
    file_id: str
    employer_name: Optional[str]
    pay_date: Optional[str]
    period_start: Optional[str]
    period_end: Optional[str]
    period_type: Optional[str]
    country: Optional[str]
    currency: Optional[str]
    gross: Optional[float]
    net: Optional[float]
    tax_income: Optional[float]
    ni_prsi: Optional[float]
    pension_employee: Optional[float]
    pension_employer: Optional[float]
    student_loan: Optional[float]
    other_deductions: Optional[float]
    ytd: Optional[Dict[str, Any]]
    confidence_overall: Optional[float]
    review_required: bool
    conflict: bool
    explainer_text: Optional[str]


@dataclass(slots=True)
class DossierTotals:
    gross: float
    net: float
    tax_income: float
    ni_prsi: float
    pension_employee: float
    pension_employer: float


@dataclass(slots=True)
class DossierMonth:
    month: str
    gross: float
    net: float
    tax_income: float
    ni_prsi: float
    pension_employee: float


@dataclass(slots=True)
class DossierChecklistItem:
    title: str
    note: str
    link: str


@dataclass(slots=True)
class DossierResponse:
    totals: DossierTotals
    months: list[DossierMonth]
    checklist: list[DossierChecklistItem]
