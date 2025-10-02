# OpenAPI Security Verification — /internal/jobs/{id}

- **Specification**: `openapi/api.yaml` now declares both `internalToken` and `bearerAuth` requirements for `GET /internal/jobs/{id}` with explicit `401` and `403` responses documented.【F:openapi/api.yaml†L68-L93】
- **Implementation**: FastAPI route depends on `get_current_or_internal`, accepting either the internal header or an authenticated Supabase JWT before returning job data.【F:apps/api/main.py†L63-L72】
- **Config Alignment**: The internal secret is sourced from `INTERNAL_TOKEN` (fallback `INTERNAL_AUTH_TOKEN`) ensuring parity across services.【F:apps/common/config.py†L1-L32】
- **Result**: The runtime behavior matches the contract; unauthenticated calls receive 401/403, while internal automation continues using the shared token.
