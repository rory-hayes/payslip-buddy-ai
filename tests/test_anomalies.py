from datetime import date

from apps.worker.services.anomalies import (
    Anomaly,
    PayslipSnapshot,
    detect_anomalies,
)


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
