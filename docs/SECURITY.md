# Security Overview

- **Authentication**: All external requests must present a Supabase JWT bearer token. Tokens are validated server-side by decoding claims and ensuring the `sub` matches the authenticated user.
- **Authorization**: Supabase Row Level Security policies restrict access so users can only access their own rows. Storage objects are namespaced `{user_id}/{file_id}.pdf` with matching RLS policies.
- **Internal Access**: Administrative endpoints require the `X-Internal-Token` header that matches `INTERNAL_AUTH_TOKEN`.
- **PII Handling**: Raw PDFs stay within Supabase Storage. Redaction occurs before invoking any LLM. Only redacted imagery and structured numerical values leave the secure boundary.
- **Secrets Management**: Service role keys, OpenAI keys, and Redis credentials are injected via environment variables and never exposed to the frontend.
- **Logging**: Events are captured in the `events` table for auditability without storing sensitive content.
