from __future__ import annotations

import sys
import types

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
        "uk_scan": "Example Payslip\nEmployer: ACME Ltd\nGross Pay: £3,200.00\nIncome Tax: £520.00\nNational Insurance: £280.00\nPension (Employee): £160.00\nStudent Loan: £75.00\nNet Pay: £2,165.00\nTax Code: 1257L",  # noqa: E501
        "ie_scan": "Irish Payslip\nEmployer: Emerald Services\nGross Pay: €3,000.00\nIncome Tax: €450.00\nPRSI: €180.00\nPension (Employee): €90.00\nNet Pay: €2,280.00\nTax Code: S1",  # noqa: E501
        "password": "Confidential Payslip\nGross Pay: £2,000.00\nNet Pay: £1,400.00\nTax Code: 1257L",
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
    status_map: dict[str, str] = {}
    for fixture in fixtures:
        file_id = fixture
        fake_supabase.insert_row("files", {"id": file_id, "user_id": user_id})
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
        assert "fields" in job_row["meta"]
        assert "validations" in job_row["meta"]

    autoparse_rate = autoparse / len(fixtures)
    assert autoparse_rate >= 0.85, f"autoparse={autoparse_rate:.2f}, statuses={status_map}"

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
