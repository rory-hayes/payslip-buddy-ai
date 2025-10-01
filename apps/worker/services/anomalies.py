from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional


@dataclass(slots=True)
class PayslipSnapshot:
    payslip_id: str
    employer_name: str
    net: float
    pension_employee: float
    tax_code: Optional[str]
    ytd: Dict[str, float]
    pay_date: date
    deductions: Dict[str, float]


@dataclass(slots=True)
class Anomaly:
    type: str
    severity: str
    message: str


def detect_net_drop(current: PayslipSnapshot, history: List[PayslipSnapshot]) -> Optional[Anomaly]:
    peer = next((p for p in history if p.employer_name == current.employer_name), None)
    if not peer:
        return None
    drop = (peer.net - current.net) / peer.net if peer.net else 0.0
    if drop > 0.05:
        return Anomaly(
            type="NET_DROP",
            severity="medium",
            message=f"Net pay decreased by {drop * 100:.1f}% compared to previous period.",
        )
    return None


def detect_missing_pension(current: PayslipSnapshot, history: List[PayslipSnapshot]) -> Optional[Anomaly]:
    pension_history = [p for p in history if p.pension_employee > 0.0]
    if len(pension_history) >= 2 and current.pension_employee == 0.0:
        return Anomaly(
            type="MISSING_PENSION",
            severity="high",
            message="Employee pension contributions missing despite previous deductions.",
        )
    return None


def detect_tax_code_change(current: PayslipSnapshot, history: List[PayslipSnapshot]) -> Optional[Anomaly]:
    if not current.tax_code:
        return None
    if any(p.tax_code and p.tax_code != current.tax_code for p in history):
        return Anomaly(
            type="TAX_CODE_CHANGE",
            severity="low",
            message="Tax code changed compared to prior periods.",
        )
    return None


def detect_ytd_regression(current: PayslipSnapshot, history: List[PayslipSnapshot]) -> Optional[Anomaly]:
    for peer in history:
        for key, value in current.ytd.items():
            previous = peer.ytd.get(key)
            if previous is not None and value < previous:
                return Anomaly(
                    type="YTD_REGRESSION",
                    severity="high",
                    message=f"Year-to-date {key} decreased from {previous:.2f} to {value:.2f}.",
                )
    return None


def detect_new_deduction(current: PayslipSnapshot, history: List[PayslipSnapshot]) -> Optional[Anomaly]:
    historic_labels = {label for peer in history for label in peer.deductions}
    for label in current.deductions:
        if label not in historic_labels and current.deductions[label] > 0:
            return Anomaly(
                type="NEW_DEDUCTION",
                severity="medium",
                message=f"New deduction detected: {label}.",
            )
    return None


def detect_anomalies(current: PayslipSnapshot, history: List[PayslipSnapshot]) -> List[Anomaly]:
    detectors = [
        detect_net_drop,
        detect_missing_pension,
        detect_tax_code_change,
        detect_ytd_regression,
        detect_new_deduction,
    ]
    findings: List[Anomaly] = []
    for detector in detectors:
        anomaly = detector(current, history)
        if anomaly:
            findings.append(anomaly)
    return findings
