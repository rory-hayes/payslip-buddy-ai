-- Storage Security: RLS policies for payslips bucket
-- Users can only access their own files based on user_id prefix

-- Insert policy: users may insert only under {user_id}/...
create policy "users_insert_own_prefix"
on storage.objects for insert
with check (
  bucket_id = 'payslips' 
  and ((auth.uid())::text = split_part(name, '/', 1))
);

-- Select policy: users may read only their own objects
create policy "users_select_own_prefix"
on storage.objects for select
using (
  bucket_id = 'payslips' 
  and ((auth.uid())::text = split_part(name, '/', 1))
);

-- Delete policy: users may delete only their own objects
create policy "users_delete_own_prefix"
on storage.objects for delete
using (
  bucket_id = 'payslips' 
  and ((auth.uid())::text = split_part(name, '/', 1))
);

-- Jobs table: track async operations (extraction, anomaly detection, exports, etc.)
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid references public.files(id) on delete cascade,
  kind text not null check (kind in ('extract', 'detect_anomalies', 'hr_pack', 'dossier', 'delete_all', 'export_all')),
  status text not null default 'queued' check (status in ('queued', 'running', 'needs_review', 'done', 'failed')),
  error text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS and create policy for jobs
alter table public.jobs enable row level security;

create policy "users_manage_own_jobs"
on public.jobs for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Trigger for jobs updated_at
create trigger update_jobs_updated_at
before update on public.jobs
for each row
execute function public.update_updated_at_column();

-- Redactions table: store bounding boxes for redacted PII
create table public.redactions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  boxes jsonb not null, -- [[x,y,w,h,label], ...]
  created_at timestamptz default now()
);

-- Enable RLS for redactions (access via file ownership)
alter table public.redactions enable row level security;

create policy "users_manage_own_redactions"
on public.redactions for all
using (
  exists (
    select 1 from public.files f 
    where f.id = redactions.file_id 
    and f.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.files f 
    where f.id = redactions.file_id 
    and f.user_id = auth.uid()
  )
);

-- LLM usage tracking table
create table public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  model text,
  tokens_input int,
  tokens_output int,
  cost numeric(10, 4),
  created_at timestamptz default now()
);

-- Enable RLS for llm_usage
alter table public.llm_usage enable row level security;

create policy "users_view_own_llm_usage"
on public.llm_usage for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Events table: audit trail for user actions
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Enable RLS for events
alter table public.events enable row level security;

create policy "users_manage_own_events"
on public.events for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);