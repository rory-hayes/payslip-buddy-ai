from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Optional

import requests
from storage3 import StorageException

from apps.common.config import get_settings
from apps.common.supabase import get_supabase

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class StorageObject:
    path: str
    bytes: bytes
    content_type: str


class StorageService:
    """Helper around Supabase storage for binary artifacts."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._supabase = get_supabase().client

    @property
    def bucket(self) -> str:
        return self._settings.supabase_storage_bucket

    @property
    def client(self):  # pragma: no cover - simple proxy
        return self._supabase

    def _build_path(self, user_id: str, name: str) -> str:
        return f"{user_id}/{name}"

    def create_signed_url(self, path: str, expires_in: int = 300) -> str:
        try:
            signed = self._supabase.storage.from_(self.bucket).create_signed_url(path, expires_in=expires_in)
        except StorageException as exc:
            raise FileNotFoundError(path) from exc
        url = signed.get("signedURL") or signed.get("signed_url")
        if not url:
            raise FileNotFoundError(path)
        return url

    def download_pdf(self, *, user_id: str, file_id: str, password: Optional[str] = None) -> StorageObject:
        path = self._build_path(user_id, f"{file_id}.pdf")
        LOGGER.info("Downloading PDF from storage", extra={"path": path})
        url = self.create_signed_url(path)
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.content
        if password:
            LOGGER.debug("Password provided for PDF; downstream processor will handle decryption.")
        return StorageObject(path=path, bytes=data, content_type="application/pdf")

    def upload_bytes(self, *, user_id: str, name: str, content_type: str, data: bytes) -> StorageObject:
        path = self._build_path(user_id, name)
        LOGGER.info("Uploading artifact to storage", extra={"path": path, "content_type": content_type})
        file_obj = io.BytesIO(data)
        self._supabase.storage.from_(self.bucket).upload(
            path,
            file_obj,
            {"upsert": True, "contentType": content_type},
        )
        return StorageObject(path=path, bytes=data, content_type=content_type)

    def fetch_signed_object(self, path: str, *, expires_in: int = 300) -> StorageObject:
        LOGGER.info("Fetching signed object from storage", extra={"path": path})
        url = self.create_signed_url(path, expires_in=expires_in)
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "application/octet-stream")
        return StorageObject(path=path, bytes=response.content, content_type=content_type)

    def delete_objects(self, paths: list[str]) -> None:
        filtered = [path for path in paths if path]
        if not filtered:
            return
        try:
            self._supabase.storage.from_(self.bucket).remove(filtered)
        except Exception as exc:  # pragma: no cover - deletion best effort
            LOGGER.warning("Failed to delete storage objects", extra={"paths": filtered, "error": str(exc)})


def get_storage_service() -> StorageService:
    return StorageService()
