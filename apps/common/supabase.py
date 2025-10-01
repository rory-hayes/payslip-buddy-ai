from __future__ import annotations

from typing import Any, Dict, Optional

from supabase import Client, create_client

from .config import get_settings


class SupabaseService:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    @property
    def client(self) -> Client:
        return self._client

    def table_select_single(self, table: str, *, match: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        response = self._client.table(table).select("*").match(match).execute()
        data = response.data or []
        return data[0] if data else None

    def insert_row(self, table: str, row: Dict[str, Any]) -> Dict[str, Any]:
        response = self._client.table(table).insert(row).execute()
        return (response.data or [{}])[0]

    def update_row(self, table: str, *, match: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
        response = self._client.table(table).update(updates).match(match).execute()
        return (response.data or [{}])[0]

    def rpc(self, function: str, params: Dict[str, Any]) -> Any:
        return self._client.rpc(function, params=params).execute().data


_supabase_service: SupabaseService | None = None


def get_supabase() -> SupabaseService:
    global _supabase_service
    if _supabase_service is None:
        _supabase_service = SupabaseService()
    return _supabase_service
