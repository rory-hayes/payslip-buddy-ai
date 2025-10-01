from apps.worker.services.merge import (
    LlmExtraction,
    NativeExtraction,
    infer_period_type,
    merge_native_with_llm,
    validate_identity_rule,
)


def test_merge_prefers_native_values():
    native = NativeExtraction(
        employer_name="ACME",
        pay_date="2024-04-30",
        period_start="2024-04-01",
        period_end="2024-04-30",
        currency="GBP",
        country="UK",
        gross=3500.0,
        net=2500.0,
        tax_income=500.0,
        ni_prsi=200.0,
        pension_employee=100.0,
        pension_employer=150.0,
        student_loan=50.0,
        other_deductions=75.0,
        ytd={"gross": 14000.0},
        tax_code="1257L",
    )
    llm = LlmExtraction(
        payload={
            "employer_name": "Different",
            "gross": 3600.0,
            "net": 2600.0,
            "tax_income": 520.0,
            "ni_prsi": 220.0,
            "pension_employee": 110.0,
            "pension_employer": 160.0,
            "student_loan": 60.0,
            "other_deductions": [{"label": "Gym", "amount": 30.0}],
            "ytd": {"gross": 15000.0},
            "country": "UK",
            "currency": "GBP",
            "confidence_overall": 0.95,
        }
    )
    merged = merge_native_with_llm(native, llm)
    assert merged["employer_name"] == "ACME"
    assert merged["gross"] == 3500.0
    assert merged["other_deductions"] == 30.0


def test_identity_rule_checks_balance():
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
    llm = LlmExtraction(
        payload={
            "country": "UK",
            "currency": "GBP",
            "gross": 2000.0,
            "net": 1400.0,
            "tax_income": 400.0,
            "ni_prsi": 120.0,
            "pension_employee": 50.0,
            "pension_employer": 60.0,
            "student_loan": 20.0,
            "other_deductions": [{"label": "Benefit", "amount": 10.0}],
            "ytd": {},
            "confidence_overall": 0.9,
        }
    )
    merged = merge_native_with_llm(native, llm)
    assert validate_identity_rule(merged)
    merged["net"] = 1000.0
    assert not validate_identity_rule(merged)


def test_infer_period_type():
    assert infer_period_type("2024-04-01", "2024-04-30") == "monthly"
    assert infer_period_type("2024-04-01", "2024-04-14") == "fortnightly"
    assert infer_period_type("2024-04-01", "2024-04-07") == "weekly"
    assert infer_period_type(None, None) is None
