from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict

from apps.common.supabase import get_supabase
from .storage import get_storage_service

LOGGER = logging.getLogger(__name__)


def delete_user_data(user_id: str, *, purge_all: bool = False) -> None:
    supabase = get_supabase()
    storage = get_storage_service()
    files_response = (
        supabase.client.table("files")
        .select("id, s3_key_original, s3_key_redacted")
        .eq("user_id", user_id)
        .execute()
    )
    for row in files_response.data or []:
        path = row.get("s3_key_original") or f"{user_id}/{row['id']}.pdf"
        preview_path = row.get("s3_key_redacted") or f"{user_id}/{row['id']}_redacted.png"
        storage.delete_objects([path, preview_path])
    tables = ["payslips", "files", "anomalies", "redactions", "llm_usage", "events", "jobs"]
    for table in tables:
        LOGGER.info("Deleting from %s", table)
        supabase.client.table(table).delete().eq("user_id", user_id).execute()
    if purge_all:
        supabase.client.table("settings").delete().eq("user_id", user_id).execute()


def retention_cleanup(default_days: int = 90) -> Dict[str, int]:
    supabase = get_supabase()
    storage = get_storage_service()
    settings_response = supabase.client.table("settings").select("user_id, retention_days").execute()
    now = datetime.now(timezone.utc)
    counts: Dict[str, int] = {}
    for row in settings_response.data or []:
        user_id = row["user_id"]
        retention_days = row.get("retention_days") or default_days
        cutoff = (now - timedelta(days=retention_days)).isoformat()
        old_files = (
            supabase.client.table("files")
            .select("id, s3_key_original, s3_key_redacted, created_at")
            .eq("user_id", user_id)
            .lt("created_at", cutoff)
            .execute()
        )
        for file_row in old_files.data or []:
            path = file_row.get("s3_key_original") or f"{user_id}/{file_row['id']}.pdf"
            preview_path = file_row.get("s3_key_redacted") or f"{user_id}/{file_row['id']}_redacted.png"
            storage.delete_objects([path, preview_path])
        supabase.client.table("files").delete().eq("user_id", user_id).lt("created_at", cutoff).execute()
        response = supabase.client.table("payslips").delete().eq("user_id", user_id).lt("created_at", cutoff).execute()
        counts[user_id] = len(response.data or [])
    return counts


__all__ = ["delete_user_data", "retention_cleanup"]
