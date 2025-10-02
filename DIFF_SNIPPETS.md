# Key Remediation Diffs

## Supabase client uses environment variables
```diff
-const SUPABASE_URL = "https://lmmjnsqxvadbygfsavke.supabase.co";
-const SUPABASE_PUBLISHABLE_KEY = "<hard-coded anon key>";
-export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
+const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
+const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
+if (!supabaseUrl || !supabaseAnonKey) {
+  throw new Error('Supabase environment variables are not set.');
+}
+export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
```【F:src/integrations/supabase/client.ts†L1-L22】

## Internal job detail authentication
```diff
-@app.get("/internal/jobs/{job_id}")
-async def get_job(job_id: str, request: Request) -> Dict[str, Any]:
-    internal_header = request.headers.get("X-Internal-Token")
-    if internal_header:
-        require_internal_token(request)
+@app.get("/internal/jobs/{job_id}")
+async def get_job(
+    job_id: str,
+    _: Optional[AuthenticatedUser] = Depends(get_current_or_internal),
+) -> Dict[str, Any]:
     supabase = get_supabase()
     job = supabase.table_select_single("jobs", match={"id": job_id})
```
OpenAPI adds `internalToken`/`bearerAuth` security with 401/403 responses.【F:apps/api/main.py†L63-L72】【F:openapi/api.yaml†L68-L93】

## Export ZIP includes PDFs and CSVs
```diff
-        archive.writestr("payslips.json", json.dumps(payslips, indent=2, default=str))
-        archive.writestr("anomalies.json", json.dumps(anomalies, indent=2, default=str))
-        archive.writestr("settings.json", json.dumps(settings, indent=2, default=str))
-        for file_row in files:
-            key = file_row.get("s3_key_original") or file_row.get("storage_path")
-            if not key:
-                continue
-            archive.writestr(f"pdfs/{Path(key).name}", "")
+        archive.writestr("payslips.json", json.dumps(payslips, indent=2, default=str))
+        archive.writestr("anomalies.json", json.dumps(anomalies, indent=2, default=str))
+        archive.writestr("settings.json", json.dumps(settings, indent=2, default=str))
+        archive.writestr("payslips.csv", _dicts_to_csv(payslips))
+        archive.writestr("files.csv", _dicts_to_csv(files))
+        archive.writestr("anomalies.csv", _dicts_to_csv(anomalies))
+        archive.writestr("settings.csv", _dicts_to_csv([settings] if settings else []))
+        for file_row in files:
+            file_id = file_row.get("id")
+            if not file_id:
+                continue
+            pdf_object = storage_service.download_pdf(user_id=user_id, file_id=str(file_id))
+            archive.writestr(f"pdfs/{file_id}.pdf", pdf_object.bytes)
```${F:apps/worker/services/reports.py†L132-L161】

## HR pack embeds redacted preview
```diff
-def generate_hr_pack_pdf(user_id: str, payload: Dict[str, Any]) -> ReportArtifact:
-    html = _render_html("HR Summary Pack", payload)
+def generate_hr_pack_pdf(user_id: str, payload: Dict[str, Any]) -> ReportArtifact:
+    preview = payload.get("redacted_preview") if isinstance(payload, dict) else None
+    rendered_payload = json.loads(json.dumps(payload)) if isinstance(payload, dict) else payload
+    if isinstance(rendered_payload, dict) and preview:
+        preview_copy = dict(preview)
+        preview_copy.pop("image_data", None)
+        rendered_payload["redacted_preview"] = preview_copy
+    html = _render_html("HR Summary Pack", rendered_payload, preview=preview)
```
Worker fetches the latest redacted PNG, signs it, and attaches base64 data before PDF generation.【F:apps/worker/tasks.py†L443-L487】

## Supabase types updated for redactions.user_id
```diff
       redactions: {
         Row: {
           boxes: Json
           created_at: string | null
           file_id: string
           id: string
+          user_id: string
         }
         Insert: {
           boxes: Json
           created_at?: string | null
           file_id: string
           id?: string
+          user_id: string
         }
         Update: {
           boxes?: Json
           created_at?: string | null
           file_id?: string
           id?: string
+          user_id?: string
         }
```${F:src/integrations/supabase/types.ts†L332-L354}

## Supabase secret guard script
```diff
+PATTERN='(https://[a-z0-9-]{12,}\.supabase\.co|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9)'
+
+violations=()
+while IFS= read -r file; do
+  if grep -nE "$PATTERN" "$file" >/tmp/grep_out.$$; then
+    while IFS= read -r line; do
+      violations+=("$file:$line")
+    done < /tmp/grep_out.$$
+  fi
+done < <(git ls-files | grep -Ev '(^scripts/ci/check_supabase_keys\.sh$|node_modules/|\.env|\.cache)')
+rm -f /tmp/grep_out.$$ || true
+
+if ((${#violations[@]})); then
+  printf 'Supabase secret guard failed. Remove hard-coded URLs or keys:\n' >&2
+  printf '  %s\n' "${violations[@]}" >&2
+  exit 1
+fi
+
+echo "Supabase secret guard passed."
```${F:scripts/ci/check_supabase_keys.sh†L1-L22}
