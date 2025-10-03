from __future__ import annotations

import io
import json
import sys
import types
import zipfile
from pathlib import Path

import pytest

if "requests" not in sys.modules:  # pragma: no cover - testing shim
    requests_stub = types.ModuleType("requests")

    class _StubResponse:
        def __init__(self) -> None:
            self.content = b""

        def raise_for_status(self) -> None:
            return None

    def _stub_get(url: str, timeout: int = 30) -> _StubResponse:  # noqa: ANN001 - signature mimic
        return _StubResponse()

    requests_stub.get = _stub_get  # type: ignore[attr-defined]
    sys.modules["requests"] = requests_stub

if "supabase" not in sys.modules:
    supabase_stub = types.ModuleType("supabase")

    class _Client:  # pragma: no cover - placeholder
        def __init__(self) -> None:
            self.storage = types.SimpleNamespace(from_=lambda *args, **kwargs: types.SimpleNamespace(create_signed_url=lambda *a, **k: {"signedURL": ""}, upload=lambda *a, **k: None, remove=lambda *a, **k: None))

    def _create_client(*args, **kwargs):  # noqa: ANN001 - signature mimic
        return _Client()

    supabase_stub.Client = _Client
    supabase_stub.create_client = _create_client
    sys.modules["supabase"] = supabase_stub

    supabase_storage = types.ModuleType("supabase.storage")

    class StorageException(Exception):
        pass

    supabase_storage.StorageException = StorageException
    sys.modules["supabase.storage"] = supabase_storage

from apps.common.models import JobKind, JobStatus
from apps.worker.services.pdf import PdfText
from apps.worker.tasks import job_detect_anomalies, job_dossier, job_export_all, job_extract, job_hr_pack


@pytest.fixture
def ocr_mapping():
    return {
        "uk_text": "ACME Payroll\nEmployer: ACME Ltd\nGross Pay: £3,200.00\nIncome Tax: £520.00\nNational Insurance: £280.00\nPension (Employee): £160.00\nStudent Loan: £75.00\nNet Pay: £2,165.00\nTax Code: 1257L",  # noqa: E501
        "uk_scan": "Example Payslip\nEmployer: ACME Ltd\nGross Pay: £3,200.00\nIncome Tax: £520.00\nNational Insurance: £280.00\nPension (Employee): £160.00\nStudent Loan: £75.00\nNet Pay: £2,165.00\nTax Code: 1257L",  # noqa: E501
        "ie_text": "Irish Payslip\nEmployer: Emerald Services\nGross Pay: €3,000.00\nIncome Tax: €450.00\nPRSI: €180.00\nPension (Employee): €90.00\nNet Pay: €2,280.00\nTax Code: S1",  # noqa: E501
        "ie_scan": "Irish Payslip\nEmployer: Emerald Services\nGross Pay: €3,000.00\nIncome Tax: €450.00\nPRSI: €180.00\nPension (Employee): €90.00\nNet Pay: €2,280.00\nTax Code: S1",  # noqa: E501
        "password": "Confidential Payslip\nGross Pay: £2,000.00\nIncome Tax: £300.00\nNational Insurance: £150.00\nPension (Employee): £100.00\nStudent Loan: £50.00\nNet Pay: £1,400.00\nTax Code: 1257L",
        "multi_page": "Quarterly Summary\nGross Pay: £9,600.00\nIncome Tax: £1,560.00\nNational Insurance: £840.00\nPension (Employee): £300.00\nStudent Loan: £0.00\nNet Pay: £6,900.00",
    }


def test_end_to_end_pipeline(monkeypatch, fake_supabase, fake_storage, fixture_state, ocr_mapping):
    fixtures = [
        "uk_text",
        "uk_scan",
        "ie_text",
        "ie_scan",
        "password",
        "multi_page",
    ]
    user_id = "user-1"

    monkeypatch.setattr("apps.worker.tasks.get_supabase", lambda: fake_supabase)
    monkeypatch.setattr("apps.worker.tasks._ensure_storage_service", lambda: fake_storage)
    monkeypatch.setattr("apps.worker.tasks.scan_bytes", lambda *args, **kwargs: None)
    monkeypatch.setattr("apps.worker.services.reports.get_supabase", lambda: fake_supabase)

    send_calls = []
    monkeypatch.setattr(
        "apps.worker.tasks.celery_app.send_task",
        lambda name, args=None, kwargs=None: send_calls.append((name, args or [])),
    )

    def fake_ocr(data, **kwargs):
        file_id = fixture_state.get("current_file")
        text = ocr_mapping.get(file_id, "")
        return PdfText(raw_text=text, has_text=bool(text.strip()))

    monkeypatch.setattr("apps.worker.tasks.perform_ocr", fake_ocr)

    autoparse = 0
    identity_pass = 0
    status_map: dict[str, str] = {}
    for fixture in fixtures:
        file_id = fixture
        fake_supabase.insert_row(
            "files",
            {
                "id": file_id,
                "user_id": user_id,
                "s3_key_original": f"{user_id}/{file_id}.pdf",
            },
        )
        job_id = f"job-{file_id}"
        fake_supabase.insert_row(
            "jobs",
            {
                "id": job_id,
                "user_id": user_id,
                "file_id": file_id,
                "kind": JobKind.EXTRACT.value,
                "status": JobStatus.QUEUED.value,
                "meta": {"disable_llm": True, **({"pdfPassword": "test123"} if fixture == "password" else {})},
            },
        )
        job_extract(job_id)
        job_row = fake_supabase.table_select_single("jobs", match={"id": job_id})
        assert job_row["status"] in {JobStatus.DONE.value, JobStatus.NEEDS_REVIEW.value}
        status_map[fixture] = job_row["status"]
        if job_row["status"] == JobStatus.DONE.value:
            autoparse += 1
        if (job_row.get("meta") or {}).get("validations", {}).get("identity"):
            identity_pass += 1
        assert "fields" in job_row["meta"]
        assert "validations" in job_row["meta"]

    autoparse_rate = autoparse / len(fixtures)
    assert autoparse_rate >= 0.85, f"autoparse={autoparse_rate:.2f}, statuses={status_map}"

    # Simulate a low-confidence run that requires manual review and ensure metadata is available
    review_job = fake_supabase.insert_row(
        "jobs",
        {
            "user_id": user_id,
            "file_id": "uk_text",
            "kind": JobKind.EXTRACT.value,
            "status": JobStatus.QUEUED.value,
            "meta": {},
        },
    )
    monkeypatch.setattr("apps.worker.tasks.calculate_confidence", lambda *args, **kwargs: 0.4)
    job_extract(review_job["id"])
    review_row = fake_supabase.table_select_single("jobs", match={"id": review_job["id"]})
    assert review_row["status"] == JobStatus.NEEDS_REVIEW.value
    meta = review_row.get("meta") or {}
    assert meta.get("reviewRequired") is True
    assert meta.get("imageUrl")
    assert isinstance(meta.get("highlights"), list)
    fake_supabase.update_row(
        "payslips", match={"file_id": review_job["file_id"]}, updates={"review_required": False}
    )
    fake_supabase.update_row(
        "jobs", match={"id": review_job["id"]}, updates={"status": JobStatus.DONE.value}
    )

    for name, args in send_calls:
        assert name == "jobs.detect_anomalies"
        follow_up_id = args[0]
        job_detect_anomalies(follow_up_id)
        follow_row = fake_supabase.table_select_single("jobs", match={"id": follow_up_id})
        assert follow_row["status"] == JobStatus.DONE.value

    dossier_job = fake_supabase.insert_row(
        "jobs",
        {
            "user_id": user_id,
            "kind": JobKind.DOSSIER.value,
            "status": JobStatus.QUEUED.value,
            "meta": {"year": 2024},
        },
    )
    job_dossier(dossier_job["id"])
    dossier_row = fake_supabase.table_select_single("jobs", match={"id": dossier_job["id"]})
    assert dossier_row["meta"].get("download_url")

    export_job = fake_supabase.insert_row(
        "jobs",
        {
            "user_id": user_id,
            "kind": JobKind.EXPORT_ALL.value,
            "status": JobStatus.QUEUED.value,
            "meta": {},
        },
    )
    job_export_all(export_job["id"])
    export_row = fake_supabase.table_select_single("jobs", match={"id": export_job["id"]})
    assert export_row["meta"].get("download_url")
    export_bytes = next(data for path, data in fake_storage.uploads.items() if path.endswith("export.zip"))
    with zipfile.ZipFile(io.BytesIO(export_bytes)) as archive:
        members = archive.namelist()
        for csv_name in ["payslips.csv", "files.csv", "anomalies.csv", "settings.csv"]:
            assert csv_name in members
        expected_pdfs = {f"pdfs/{fixture}.pdf" for fixture in fixtures}
        assert expected_pdfs.issubset(set(members))
        for pdf_name in expected_pdfs:
            assert archive.read(pdf_name)

    hr_job = fake_supabase.insert_row(
        "jobs",
        {
            "user_id": user_id,
            "kind": JobKind.HR_PACK.value,
            "status": JobStatus.QUEUED.value,
            "meta": {"payload": {"summary": "ok"}},
        },
    )
    job_hr_pack(hr_job["id"])
    hr_row = fake_supabase.table_select_single("jobs", match={"id": hr_job["id"]})
    assert hr_row["meta"].get("download_url")

    # Ensure uploads occurred for preview/dossier/export artifacts
    assert any(path.endswith("_redacted.png") for path in fake_storage.uploads)
    assert any(path.endswith("dossier.pdf") for path in fake_storage.uploads)
    assert any(path.endswith("export.zip") for path in fake_storage.uploads)
    assert any(path.endswith("hr_pack.pdf") for path in fake_storage.uploads)

    identity_rate = identity_pass / len(fixtures)
    anomaly_counts: dict[str, int] = {}
    for anomaly in fake_supabase.tables["anomalies"]:
        key = anomaly.get("type") or "unknown"
        anomaly_counts[key] = anomaly_counts.get(key, 0) + 1
    reports_dir = Path("reports")
    reports_dir.mkdir(exist_ok=True)
    metrics = {
        "autoparse_rate": autoparse_rate,
        "identity_pass_rate": identity_rate,
        "anomaly_counts": anomaly_counts,
    }
    (reports_dir / "pipeline_metrics.json").write_text(json.dumps(metrics, indent=2, sort_keys=True))
    assert identity_rate >= 0.98, f"identity_rate={identity_rate:.2f}"
