import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest


@dataclass
class StorageObject:
    path: str
    bytes: bytes
    content_type: str


class FakeQuery:
    def __init__(self, service, table):
        self._service = service
        self._table = table
        self._filters = []
        self._order = None
        self._desc = False
        self._limit = None

    def select(self, *_):
        return self

    def match(self, match):
        self._filters.append(lambda row: all(row.get(k) == v for k, v in match.items()))
        return self

    def eq(self, key, value):
        self._filters.append(lambda row: row.get(key) == value)
        return self

    def lt(self, key, value):
        self._filters.append(lambda row: row.get(key) < value)
        return self

    def order(self, key, desc=False):
        self._order = key
        self._desc = desc
        return self

    def limit(self, value):
        self._limit = value
        return self

    def execute(self):
        rows = list(self._service.tables[self._table])
        for predicate in self._filters:
            rows = [row for row in rows if predicate(row)]
        if self._order:
            rows.sort(key=lambda row: row.get(self._order) or "", reverse=self._desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return SimpleNamespace(data=rows)


class FakeClient:
    def __init__(self, service):
        self._service = service

    def table(self, name):
        return FakeQuery(self._service, name)


class FakeSupabaseService:
    def __init__(self):
        self.tables = {
            "jobs": [],
            "files": [],
            "payslips": [],
            "anomalies": [],
            "settings": [],
            "events": [],
            "redactions": [],
        }
        self.client = FakeClient(self)

    def table_select_single(self, table, *, match):
        for row in self.tables[table]:
            if all(row.get(k) == v for k, v in match.items()):
                return row
        return None

    def insert_row(self, table, row):
        payload = dict(row)
        payload.setdefault("id", str(uuid.uuid4()))
        payload.setdefault("created_at", datetime.utcnow().isoformat())
        self.tables.setdefault(table, []).append(payload)
        return payload

    def update_row(self, table, *, match, updates):
        for row in self.tables[table]:
            if all(row.get(k) == v for k, v in match.items()):
                row.update(updates)
                return row
        return {}

    def rpc(self, function, params):
        # For dossier aggregation return synthetic totals
        if function == "rpc_dossier_aggregate":
            return {
                "year": params.get("p_year"),
                "totals": {
                    "gross": 12800.0,
                    "net": 8600.0,
                },
            }
        return {}


class FakeStorageService:
    def __init__(self, fixtures, state):
        self._fixtures = fixtures
        self._state = state
        self.uploads = {}

    def download_pdf(self, *, user_id, file_id, password=None):
        self._state["current_file"] = file_id
        path = self._fixtures / f"{file_id}.pdf"
        data = path.read_bytes()
        storage_path = f"{user_id}/{file_id}.pdf"
        return StorageObject(path=storage_path, bytes=data, content_type="application/pdf")

    def create_signed_url(self, path, expires_in=300):  # noqa: ANN001 - test helper signature
        return f"https://storage.local/{path}?expires={expires_in}"

    def fetch_signed_object(self, path, *, expires_in=300):  # noqa: ANN001 - test helper signature
        data = self.uploads.get(path)
        if data is None:
            fixture_path = self._fixtures / Path(path).name
            data = fixture_path.read_bytes() if fixture_path.exists() else b""
        content_type = "image/png" if path.endswith(".png") else "application/octet-stream"
        return StorageObject(path=path, bytes=data, content_type=content_type)

    def upload_bytes(self, *, user_id, name, content_type, data):
        path = f"{user_id}/{name}"
        self.uploads[path] = data
        return StorageObject(path=path, bytes=data, content_type=content_type)

    def delete_objects(self, paths):  # pragma: no cover - not needed for tests
        return None


@pytest.fixture
def fake_supabase():
    return FakeSupabaseService()


@pytest.fixture
def fixture_state():
    return {"current_file": None}


@pytest.fixture
def fake_storage(tmp_path, fixture_state):
    return FakeStorageService(Path("scripts/fixtures"), fixture_state)
