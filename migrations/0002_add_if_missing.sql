alter table public.redactions
    add column if not exists user_id uuid;

create index if not exists idx_redactions_user_id on public.redactions(user_id);
