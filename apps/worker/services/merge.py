from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass(slots=True)
class NativeExtraction:
    employer_name: Optional[str]
    pay_date: Optional[str]
    period_start: Optional[str]
    period_end: Optional[str]
    currency: Optional[str]
    country: Optional[str]
    gross: Optional[float]
    net: Optional[float]
    tax_income: Optional[float]
    ni_prsi: Optional[float]
    pension_employee: Optional[float]
    pension_employer: Optional[float]
    student_loan: Optional[float]
    other_deductions: Optional[float]
    ytd: Optional[Dict[str, Any]]
    tax_code: Optional[str]


@dataclass(slots=True)
class LlmExtraction:
    payload: Dict[str, Any]


IDENTITY_TOLERANCE = 0.5


def _parse_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def merge_native_with_llm(native: NativeExtraction, llm: LlmExtraction) -> Dict[str, Any]:
    payload = llm.payload
    merged: Dict[str, Any] = {}
    fields = [
        "employer_name",
        "pay_date",
        "period_start",
        "period_end",
        "currency",
        "country",
        "gross",
        "net",
        "tax_income",
        "ni_prsi",
        "pension_employee",
        "pension_employer",
        "student_loan",
        "ytd",
        "tax_code",
    ]
    for field in fields:
        native_value = getattr(native, field)
        if native_value not in (None, ""):
            merged[field] = native_value
        else:
            merged[field] = payload.get(field)
    merged["other_deductions"] = _sum_other_deductions(payload.get("other_deductions", []))
    merged["confidence_overall"] = payload.get("confidence_overall", 0.0)
    merged["currency"] = merged.get("currency") or payload.get("currency")
    merged["country"] = merged.get("country") or payload.get("country")
    return merged


def _sum_other_deductions(items: List[Dict[str, Any]]) -> float:
    total = 0.0
    for item in items:
        total += float(item.get("amount", 0.0))
    return round(total, 2)


def validate_identity_rule(merged: Dict[str, Any]) -> bool:
    gross = _parse_float(merged.get("gross"))
    net = _parse_float(merged.get("net"))
    tax_income = _parse_float(merged.get("tax_income")) or 0.0
    ni_prsi = _parse_float(merged.get("ni_prsi")) or 0.0
    pension_employee = _parse_float(merged.get("pension_employee")) or 0.0
    student_loan = _parse_float(merged.get("student_loan")) or 0.0
    other_deductions = _parse_float(merged.get("other_deductions")) or 0.0
    if gross is None or net is None:
        return False
    expected_net = gross - (tax_income + ni_prsi + pension_employee + student_loan + other_deductions)
    return abs(expected_net - net) <= IDENTITY_TOLERANCE


def infer_period_type(period_start: Optional[str], period_end: Optional[str]) -> Optional[str]:
    if not period_start or not period_end:
        return None
    try:
        start = datetime.fromisoformat(period_start).date()
        end = datetime.fromisoformat(period_end).date()
    except ValueError:
        return None
    delta = (end - start).days + 1
    if delta >= 27:
        return "monthly"
    if delta >= 13:
        return "fortnightly"
    if delta >= 6:
        return "weekly"
    return None


def normalize_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed.date().isoformat()
