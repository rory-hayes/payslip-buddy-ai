from __future__ import annotations

import re
from datetime import datetime
from typing import Dict, Optional

from apps.worker.services.merge import NativeExtraction

UK_TAX_CODE = re.compile(r"^((\d{1,4}[A-Z]{1,2})|([A-Z]{1,2}\d{1,4})|(NT|BR|D\d))$")
IE_TAX_CODE = re.compile(r"^[A-Z]{1,2}\d{1,3}[A-Z]{0,2}$")


def count_native_fields(native: NativeExtraction) -> int:
    fields = [
        native.gross,
        native.net,
        native.tax_income,
        native.ni_prsi,
        native.pension_employee,
        native.pay_date,
        native.period_start,
        native.period_end,
        native.tax_code,
    ]
    return sum(1 for value in fields if value not in (None, ""))


def validate_ytd_monotonic(current: Dict[str, float], previous: Optional[Dict[str, float]]) -> bool:
    if not current:
        return True
    if not previous:
        return True
    for key, value in current.items():
        if value is None:
            continue
        prev = previous.get(key)
        if prev is None:
            continue
        try:
            current_val = float(value)
            previous_val = float(prev)
        except (TypeError, ValueError):
            continue
        if current_val + 1e-6 < previous_val:
            return False
    return True


def validate_date_window(pay_date: Optional[str], period_start: Optional[str], period_end: Optional[str]) -> bool:
    if not any([pay_date, period_start, period_end]):
        return True
    try:
        pay = datetime.fromisoformat(pay_date).date() if pay_date else None
        start = datetime.fromisoformat(period_start).date() if period_start else None
        end = datetime.fromisoformat(period_end).date() if period_end else None
    except ValueError:
        return False
    if start and end and start > end:
        return False
    if end and pay and end > pay:
        return False
    return True


def validate_tax_code_format(tax_code: Optional[str], country: Optional[str]) -> bool:
    if not tax_code:
        return True
    code = tax_code.strip().upper()
    if country == "IE":
        return bool(IE_TAX_CODE.match(code))
    return bool(UK_TAX_CODE.match(code))


def calculate_confidence(
    native: NativeExtraction,
    merged_payload: Dict[str, object],
    *,
    identity_ok: bool,
    validations: Dict[str, bool],
    used_ocr: bool,
    llm_present: bool,
) -> float:
    if llm_present:
        return float(merged_payload.get("confidence_overall") or 0.0)

    base = 0.6
    populated = count_native_fields(native)
    if identity_ok and all(validations.values()):
        if populated >= 7:
            base = 0.94 if not used_ocr else 0.92
        elif populated >= 5:
            base = 0.9 if not used_ocr else 0.9
        else:
            base = 0.85
    elif identity_ok:
        base = 0.75
    if used_ocr and base < 0.89 and populated >= 5 and validations.get("ytd", True):
        base = max(base, 0.88)
    return round(base, 3)


__all__ = [
    "calculate_confidence",
    "count_native_fields",
    "validate_ytd_monotonic",
    "validate_date_window",
    "validate_tax_code_format",
]
