-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Files table (stores uploaded payslip files)
create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  sha256 text,
  s3_key_original text not null,
  s3_key_redacted text,
  file_name text not null,
  file_size int,
  created_at timestamptz default now()
);

-- Enable RLS on files
alter table public.files enable row level security;

-- RLS policies for files
create policy "Users can view their own files"
  on public.files for select
  using (auth.uid() = user_id);

create policy "Users can insert their own files"
  on public.files for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own files"
  on public.files for delete
  using (auth.uid() = user_id);

-- Payslips table (extracted payslip data)
create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_id uuid references public.files(id) on delete cascade not null,
  employer_name text,
  pay_date date,
  period_start date,
  period_end date,
  period_type text check (period_type in ('monthly', 'weekly', 'fortnightly', 'other')),
  country text check (country in ('UK', 'IE')),
  currency text check (currency in ('GBP', 'EUR')) default 'GBP',
  gross numeric(12,2),
  net numeric(12,2),
  tax_income numeric(12,2),
  ni_prsi numeric(12,2),
  pension_employee numeric(12,2),
  pension_employer numeric(12,2),
  student_loan numeric(12,2),
  other_deductions jsonb default '[]'::jsonb,
  ytd jsonb,
  confidence_overall numeric(4,3),
  review_required boolean default false,
  conflict boolean default false,
  explainer_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on payslips
alter table public.payslips enable row level security;

-- RLS policies for payslips
create policy "Users can view their own payslips"
  on public.payslips for select
  using (auth.uid() = user_id);

create policy "Users can insert their own payslips"
  on public.payslips for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own payslips"
  on public.payslips for update
  using (auth.uid() = user_id);

create policy "Users can delete their own payslips"
  on public.payslips for delete
  using (auth.uid() = user_id);

-- Anomalies table (detected issues/alerts)
create table public.anomalies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  payslip_id uuid references public.payslips(id) on delete cascade not null,
  type text not null,
  severity text check (severity in ('info', 'warn', 'error')) default 'info',
  message text not null,
  snoozed_until date,
  muted boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS on anomalies
alter table public.anomalies enable row level security;

-- RLS policies for anomalies
create policy "Users can view their own anomalies"
  on public.anomalies for select
  using (auth.uid() = user_id);

create policy "Users can update their own anomalies"
  on public.anomalies for update
  using (auth.uid() = user_id);

create policy "Users can delete their own anomalies"
  on public.anomalies for delete
  using (auth.uid() = user_id);

-- Settings table (user preferences)
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  retention_days int default 90 check (retention_days in (30, 90)),
  region text check (region in ('UK', 'IE')) default 'UK',
  locale text default 'en-GB',
  marketing_opt_in boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on settings
alter table public.settings enable row level security;

-- RLS policies for settings
create policy "Users can view their own settings"
  on public.settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on public.settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.settings for update
  using (auth.uid() = user_id);

-- Knowledge base table (region-specific tax info - publicly readable)
create table public.kb (
  id uuid primary key default gen_random_uuid(),
  region text check (region in ('UK', 'IE')) not null,
  category text not null,
  title text not null,
  note text,
  link text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Enable RLS on kb (publicly readable)
alter table public.kb enable row level security;

-- RLS policy for kb (everyone can read)
create policy "Knowledge base is publicly readable"
  on public.kb for select
  to authenticated
  using (true);

-- Profiles table (user profile data)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- RLS policies for profiles
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  
  insert into public.settings (user_id)
  values (new.id);
  
  return new;
end;
$$;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers for updated_at
create trigger update_payslips_updated_at
  before update on public.payslips
  for each row execute function public.update_updated_at_column();

create trigger update_settings_updated_at
  before update on public.settings
  for each row execute function public.update_updated_at_column();

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Seed knowledge base with UK/IE tax info
insert into public.kb (region, category, title, note, link, sort_order) values
  ('UK', 'tax_year', 'Tax Year Dates', 'UK tax year runs 6 April to 5 April', 'https://www.gov.uk/self-assessment-tax-returns', 1),
  ('UK', 'tax_year', 'Self Assessment Deadline', 'Online return deadline: 31 January', 'https://www.gov.uk/self-assessment-tax-returns/deadlines', 2),
  ('UK', 'tax_year', 'P60 Form', 'Your employer must provide a P60 by 31 May', 'https://www.gov.uk/paye-forms-p45-p60-p11d', 3),
  ('UK', 'deductions', 'National Insurance', 'NI contributions fund state benefits', 'https://www.gov.uk/national-insurance', 4),
  ('UK', 'deductions', 'Student Loan Repayment', 'Automatic deductions if you earn above threshold', 'https://www.gov.uk/repaying-your-student-loan', 5),
  ('UK', 'pension', 'Workplace Pension', 'Minimum 5% employee + 3% employer contribution', 'https://www.gov.uk/workplace-pensions', 6),
  ('IE', 'tax_year', 'Tax Year Dates', 'Irish tax year is calendar year (1 Jan - 31 Dec)', 'https://www.revenue.ie/', 1),
  ('IE', 'tax_year', 'Tax Return Deadline', 'Online return deadline: 31 October (following year)', 'https://www.revenue.ie/en/tax-professionals/tdm/income-tax-capital-gains-tax-corporation-tax/part-41a/41a-01-06.pdf', 2),
  ('IE', 'deductions', 'PRSI', 'Pay Related Social Insurance funds benefits', 'https://www.gov.ie/en/service/9f68c-prsi-pay-related-social-insurance/', 3),
  ('IE', 'deductions', 'USC', 'Universal Social Charge applies to most income', 'https://www.revenue.ie/en/jobs-and-pensions/usc/index.aspx', 4),
  ('IE', 'pension', 'Personal Retirement Savings Account', 'PRSA available from employers', 'https://www.pensionsauthority.ie/', 5);

-- Create storage bucket for payslips
insert into storage.buckets (id, name, public)
values ('payslips', 'payslips', false);

-- Storage policies for payslips bucket
create policy "Users can upload their own payslips"
  on storage.objects for insert
  with check (
    bucket_id = 'payslips' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own payslips"
  on storage.objects for select
  using (
    bucket_id = 'payslips' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own payslips"
  on storage.objects for delete
  using (
    bucket_id = 'payslips' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );