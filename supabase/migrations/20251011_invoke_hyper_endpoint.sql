-- Enable pg_net (already enabled on most projects; safe to run)
create extension if not exists pg_net;

-- Store anon key once for headers (replace with your anon key before running)
do $$
begin
  if not exists (select 1 from information_schema.tables where table_name='app_settings') then
    create table app_settings (k text primary key, v text not null);
  end if;
  insert into app_settings(k, v)
  values ('supabase_anon', '<REPLACE_WITH_SUPABASE_ANON_KEY>')
  on conflict (k) do update set v = excluded.v;
end$$;

create or replace function public.invoke_hyper_endpoint()
returns trigger
language plpgsql
as $$
declare
  anon text;
begin
  if NEW.kind = 'extract' and NEW.status = 'queued' then
    select v into anon from app_settings where k = 'supabase_anon';

    perform net.http_post(
      url := 'https://lmmjnsqxvadbygfsavke.supabase.co/functions/v1/hyper-endpoint',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey', anon
      ),
      body := jsonb_build_object('job_id', NEW.id)::text
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_jobs_extract_invoke on public.jobs;
create trigger trg_jobs_extract_invoke
after insert on public.jobs
for each row execute function public.invoke_hyper_endpoint();
