from datetime import date

from apps.worker.services.anomalies import (
    PayslipSnapshot,
    detect_anomalies,
)
from scripts.generate_history import generate_history


def snapshot(**kwargs):
    defaults = {
        "payslip_id": "1",
        "employer_name": "ACME",
        "net": 2000.0,
        "pension_employee": 100.0,
        "tax_code": "1257L",
        "ytd": {"gross": 8000.0},
        "pay_date": date(2024, 4, 30),
        "deductions": {"other": 50.0},
    }
    defaults.update(kwargs)
    return PayslipSnapshot(**defaults)


def to_snapshot(payload: dict) -> PayslipSnapshot:
    return PayslipSnapshot(
        payslip_id=payload["payslip_id"],
        employer_name=payload["employer_name"],
        net=float(payload["net"]),
        pension_employee=float(payload["pension_employee"]),
        tax_code=payload.get("tax_code"),
        ytd=payload.get("ytd") or {},
        pay_date=payload["pay_date"],
        deductions=payload.get("deductions") or {},
    )


def test_detect_anomalies_flags_expected_cases():
    previous = [
        snapshot(payslip_id="0", net=2200.0, deductions={"other": 50.0}),
        snapshot(payslip_id="-1", net=2200.0, deductions={"other": 50.0}),
    ]
    current = snapshot(net=1900.0, deductions={"other": 80.0, "New": 20.0}, pension_employee=0.0)
    findings = detect_anomalies(current, previous)
    types = {finding.type for finding in findings}
    assert "NET_DROP" in types
    assert "MISSING_PENSION" in types
    assert "NEW_DEDUCTION" in types


def test_generate_history_sequences_trigger_expected_anomalies():
    sequences = generate_history()
    for anomaly, payloads in sequences.items():
        snapshots = [to_snapshot(item) for item in payloads]
        if anomaly == "neutral":
            findings = detect_anomalies(snapshots[-1], snapshots[:-1])
            assert findings == []
            continue
        findings = detect_anomalies(snapshots[-1], snapshots[:-1])
        types = {finding.type for finding in findings}
        assert anomaly in types
