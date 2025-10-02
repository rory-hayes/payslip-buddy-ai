# OpenAPI Security Verification — /internal/jobs/{id}

- **Specification**: `openapi/api.yaml` declares both `internalToken` and `bearerAuth` requirements for `GET /internal/jobs/{id}` with explicit `401` and `403` responses documented.【F:openapi/api.yaml†L68-L93】
- **Implementation**: FastAPI now depends on `require_internal_or_authenticated`, enforcing the internal header or a valid Supabase JWT before returning job data.【F:apps/api/main.py†L63-L72】【F:apps/api/auth.py†L47-L52】
- **Config Alignment**: The internal secret is sourced from `INTERNAL_TOKEN` (fallback `INTERNAL_AUTH_TOKEN`) ensuring parity across services.【F:apps/common/config.py†L1-L32】
- **Result**: The runtime behavior matches the contract; unauthenticated calls receive 401/403, while internal automation continues using the shared token.
