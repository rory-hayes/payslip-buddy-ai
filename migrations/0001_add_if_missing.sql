-- Ensure required tables exist without destructive changes
create table if not exists public.jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    file_id uuid,
    kind text not null,
    status text not null,
    error text,
    meta jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.redactions (
    id uuid primary key default gen_random_uuid(),
    file_id uuid not null references public.files(id),
    boxes jsonb not null,
    created_at timestamptz not null default now()
);

create table if not exists public.llm_usage (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    file_id uuid,
    model text not null,
    tokens_input integer default 0,
    tokens_output integer default 0,
    cost numeric(12,4) default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    type text not null,
    payload jsonb not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_jobs_user_id on public.jobs(user_id);
create index if not exists idx_jobs_file_id on public.jobs(file_id);
create index if not exists idx_llm_usage_user_id on public.llm_usage(user_id);
create index if not exists idx_events_user_id on public.events(user_id);

alter table public.jobs
    add column if not exists error text;

alter table public.jobs
    add column if not exists meta jsonb default '{}'::jsonb;

alter table public.jobs
    add column if not exists updated_at timestamptz not null default now();
