from apps.worker.services.merge import (
    LlmExtraction,
    NativeExtraction,
    infer_period_type,
    merge_native_with_llm,
    validate_identity_rule,
)
from apps.worker.services.reports import _format_currency
from apps.worker.services.validation import (
    calculate_confidence,
    count_native_fields,
    validate_date_window,
    validate_tax_code_format,
    validate_ytd_monotonic,
)


def make_native(**kwargs) -> NativeExtraction:
    defaults = dict(
        employer_name="ACME",
        pay_date="2024-04-30",
        period_start="2024-04-01",
        period_end="2024-04-30",
        currency="GBP",
        country="UK",
        gross=3200.0,
        net=2165.0,
        tax_income=520.0,
        ni_prsi=280.0,
        pension_employee=160.0,
        pension_employer=0.0,
        student_loan=75.0,
        other_deductions=0.0,
        ytd={"gross": 12800.0, "tax": 2080.0},
        tax_code="1257L",
    )
    defaults.update(kwargs)
    return NativeExtraction(**defaults)


def test_identity_rule_and_confidence_calculation():
    native = make_native()
    llm = LlmExtraction(payload={"confidence_overall": 0.8})
    merged = merge_native_with_llm(native, llm)
    assert validate_identity_rule(merged)
    confidence = calculate_confidence(
        native,
        merged,
        identity_ok=True,
        validations={"identity": True, "ytd": True, "dates": True, "tax": True},
        used_ocr=False,
        llm_present=False,
    )
    assert confidence >= 0.9


def test_identity_rule_rejects_mismatch():
    native = make_native(net=1800.0)
    llm = LlmExtraction(payload={"confidence_overall": 0.8})
    merged = merge_native_with_llm(native, llm)
    assert not validate_identity_rule(merged)


def test_ytd_monotonic_validation():
    current = {"gross": 15000.0, "tax": 2400.0}
    previous = {"gross": 14000.0, "tax": 2300.0}
    assert validate_ytd_monotonic(current, previous)
    assert not validate_ytd_monotonic({"gross": 13000.0}, previous)


def test_date_and_tax_code_validation():
    assert validate_date_window("2024-04-30", "2024-04-01", "2024-04-30")
    assert not validate_date_window("2024-04-01", "2024-04-30", "2024-04-15")
    assert validate_tax_code_format("1257L", "UK")
    assert validate_tax_code_format("S1", "IE")
    assert not validate_tax_code_format("XYZ", "UK")


def test_infer_period_type_weekly_and_monthly():
    assert infer_period_type("2024-04-01", "2024-04-07") == "weekly"
    assert infer_period_type("2024-04-01", "2024-04-30") == "monthly"


def test_format_currency_helper():
    assert _format_currency(1234.5) == "£1,234.50"


def test_count_native_fields_tracks_presence():
    native = make_native(net=None, tax_income=None)
    assert count_native_fields(native) < 9
    native.net = 2165.0
    native.tax_income = 520.0
    assert count_native_fields(native) >= 9
