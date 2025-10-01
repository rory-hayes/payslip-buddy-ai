# Payslip Companion Runbooks

## LLM Outage or Spend Cap Reached
1. Review the `llm_usage` table filtered by `created_at` for the last 24 hours and sum the `cost` column.
2. If the total exceeds `LLM_SPEND_DAILY_CAP_USD`, confirm that the `OPENAI_API_KEY` is still valid.
3. Toggle the feature flag `meta.disable_llm=true` on queued extract jobs to force native-only extraction.
4. Communicate to support that extra manual review will be required while LLM extraction is paused.
5. When the cap resets (00:00 UTC) or the outage is resolved, remove the flag and restart workers.

## Storage or RLS Troubleshooting
1. Use the Supabase dashboard to query `files` for the affected `user_id` and verify that the `s3_key_original` matches the storage path `{user_id}/{file_id}.pdf`.
2. Generate a signed URL with the service role key and confirm the object exists in the `payslips` bucket.
3. Inspect the `storage.objects` policy for `{user_id}` prefix enforcement.
4. If RLS blocks access, confirm the JWT has the correct `sub` claim and `files.user_id` matches.

## Cron / Retention Failures
1. Check the `events` table for the most recent `retention_cleanup` payload to identify the last successful run.
2. Inspect Celery beat logs or Supabase Edge Function logs for errors.
3. Manually re-run the cleanup by enqueueing a `delete_all` job with `meta":{"retention":true}` for the impacted user.
4. After remediation, record the recovery in `events` with type `retention_manual_replay`.

## Job Queue Backlog
1. Run `celery -A apps.worker.celery_app.celery_app inspect active` to list active tasks.
2. Scale worker replicas by updating `docker-compose` or Kubernetes deployment to increase concurrency.
3. If Redis is saturated, increase max memory or provision a larger instance.
4. Confirm the frontend job poller is still responding by calling `GET /internal/jobs/{id}` with the internal token.
