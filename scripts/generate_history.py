from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, Iterable, List


@dataclass
class SyntheticSnapshot:
    payslip_id: str
    employer_name: str
    net: float
    pension_employee: float
    tax_code: str
    ytd: Dict[str, float]
    pay_date: date
    deductions: Dict[str, float]


def _baseline_sequence(employer: str = "ACME") -> List[SyntheticSnapshot]:
    start = date(2023, 12, 31)
    results: List[SyntheticSnapshot] = []
    gross = 3000.0
    tax = 450.0
    ni = 200.0
    pension = 100.0
    net = gross - tax - ni - pension
    for index in range(6):
        payslip_date = start + timedelta(days=28 * (index + 1))
        results.append(
            SyntheticSnapshot(
                payslip_id=f"{employer}-{index}",
                employer_name=employer,
                net=round(net + index * 10, 2),
                pension_employee=pension,
                tax_code="1257L",
                ytd={"gross": gross * (index + 1), "tax": tax * (index + 1)},
                pay_date=payslip_date,
                deductions={"other": 50.0},
            )
        )
    return results


def generate_history(seed: int = 42) -> Dict[str, List[Dict[str, object]]]:
    baseline = _baseline_sequence()
    sequences: Dict[str, List[SyntheticSnapshot]] = {
        "neutral": baseline,
    }

    # NET_DROP anomaly
    net_drop = baseline[:-1] + [SyntheticSnapshot(**{**asdict(baseline[-1]), "net": baseline[-2].net * 0.85})]
    sequences["NET_DROP"] = net_drop

    # MISSING_PENSION anomaly
    missing_pension = baseline[:-1] + [SyntheticSnapshot(**{**asdict(baseline[-1]), "pension_employee": 0.0})]
    sequences["MISSING_PENSION"] = missing_pension

    # TAX_CODE_CHANGE anomaly
    tax_change = baseline[:-1] + [SyntheticSnapshot(**{**asdict(baseline[-1]), "tax_code": "BR"})]
    sequences["TAX_CODE_CHANGE"] = tax_change

    # YTD_REGRESSION anomaly
    ytd_regression = baseline[:-1] + [
        SyntheticSnapshot(
            **{
                **asdict(baseline[-1]),
                "ytd": {"gross": baseline[-2].ytd["gross"], "tax": baseline[-2].ytd["tax"] - 10},
            }
        )
    ]
    sequences["YTD_REGRESSION"] = ytd_regression

    # NEW_DEDUCTION anomaly
    new_deduction = baseline[:-1] + [
        SyntheticSnapshot(
            **{
                **asdict(baseline[-1]),
                "deductions": {"other": 50.0, "Gym": 20.0},
            }
        )
    ]
    sequences["NEW_DEDUCTION"] = new_deduction

    return {key: [asdict(item) for item in values] for key, values in sequences.items()}


def export_history(path: Path, data: Dict[str, Iterable[Dict[str, object]]]) -> None:
    payload = {key: list(values) for key, values in data.items()}
    path.write_text(json.dumps(payload, indent=2, default=str))


if __name__ == "__main__":
    output = Path(__file__).with_name("synthetic_history.json")
    export_history(output, generate_history())
    print(f"Synthetic history written to {output}")
