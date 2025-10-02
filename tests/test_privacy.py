from __future__ import annotations

from apps.common.models import JobKind, JobStatus
from apps.worker.services.llm import LlmResponse
from apps.worker.tasks import job_extract


def test_llm_uses_redacted_preview_and_percent_boxes(monkeypatch, fake_supabase, fake_storage, fixture_state):
    user_id = "user-privacy"
    file_id = "uk_text"
    preview_calls: dict[str, object] = {}

    def fake_llm(user: str, file: str | None, previews):
        preview_calls["user"] = user
        preview_calls["file"] = file
        preview_calls["previews"] = previews
        return LlmResponse(
            payload={
                "country": "UK",
                "currency": "GBP",
                "gross": 3200.0,
                "net": 2165.0,
                "tax_income": 520.0,
                "ni_prsi": 280.0,
                "pension_employee": 160.0,
                "pension_employer": 0.0,
                "student_loan": 75.0,
                "other_deductions": [],
                "ytd": {},
                "confidence_overall": 0.95,
            },
            tokens=0,
            cost=0.0,
        )

    monkeypatch.setattr("apps.worker.tasks.get_supabase", lambda: fake_supabase)
    monkeypatch.setattr("apps.worker.tasks._ensure_storage_service", lambda: fake_storage)
    monkeypatch.setattr("apps.worker.tasks.scan_bytes", lambda *args, **kwargs: None)
    send_calls: list[tuple[str, list[str]]] = []

    monkeypatch.setattr("apps.worker.tasks._llm_extract", fake_llm)
    monkeypatch.setattr(
        "apps.worker.tasks.celery_app.send_task",
        lambda name, args=None, kwargs=None: send_calls.append((name, args or [])),
    )

    fake_supabase.insert_row(
        "files",
        {
            "id": file_id,
            "user_id": user_id,
            "s3_key_original": f"{user_id}/{file_id}.pdf",
        },
    )
    fake_supabase.insert_row(
        "jobs",
        {
            "id": "job-privacy",
            "user_id": user_id,
            "file_id": file_id,
            "kind": JobKind.EXTRACT.value,
            "status": JobStatus.QUEUED.value,
            "meta": {},
        },
    )

    job_extract("job-privacy")

    assert preview_calls["user"] == user_id
    assert preview_calls["file"] == file_id
    previews = preview_calls["previews"]
    assert isinstance(previews, list) and previews
    for preview in previews:
        assert preview.path.endswith("_redacted.png")

    redaction_rows = fake_supabase.tables["redactions"]
    assert redaction_rows, "redactions were not recorded"
    boxes = redaction_rows[0]["boxes"]
    for box in boxes:
        for key in ("x", "y", "w", "h"):
            assert 0.0 <= box[key] <= 100.0

    job_row = fake_supabase.table_select_single("jobs", match={"id": "job-privacy"})
    highlights = job_row["meta"]["highlights"]
    for box in highlights:
        for key in ("x", "y", "w", "h"):
            assert 0.0 <= box[key] <= 100.0
    assert job_row["meta"]["imageUrl"].endswith("_redacted.png")
    assert all(call[0] == "jobs.detect_anomalies" for call in send_calls)
