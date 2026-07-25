alter table public.profiles
  add column if not exists username text,
  add column if not exists phone_number text;

alter table public.profiles
  drop constraint if exists profiles_username_format,
  drop constraint if exists profiles_phone_number_format,
  drop constraint if exists profiles_department_code_format,
  drop constraint if exists profiles_identifier_format;

alter table public.institution_roster
  drop constraint if exists institution_roster_department_code_format,
  drop constraint if exists institution_roster_identifier_format;

alter table public.profiles
  add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  add constraint profiles_phone_number_format
    check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint profiles_department_code_format
    check (department_code in (
      'ACC', 'CSC', 'LAW', 'SWE', 'CYB', 'MLS', 'POL', 'BUS', 'NSC',
      'PBH', 'CRM', 'MCB', 'MTH', 'PST', 'MAS', 'BCH', 'ECO'
    )),
  add constraint profiles_identifier_format
    check (matric_or_staff_id ~ '^(ACC|CSC|LAW|SWE|CYB|MLS|POL|BUS|NSC|PBH|CRM|MCB|MTH|PST|MAS|BCH|ECO)/[0-9]{4}/[0-9]{3}$');

alter table public.institution_roster
  add constraint institution_roster_department_code_format
    check (department_code in (
      'ACC', 'CSC', 'LAW', 'SWE', 'CYB', 'MLS', 'POL', 'BUS', 'NSC',
      'PBH', 'CRM', 'MCB', 'MTH', 'PST', 'MAS', 'BCH', 'ECO'
    )),
  add constraint institution_roster_identifier_format
    check (matric_or_staff_id ~ '^(ACC|CSC|LAW|SWE|CYB|MLS|POL|BUS|NSC|PBH|CRM|MCB|MTH|PST|MAS|BCH|ECO)/[0-9]{4}/[0-9]{3}$');

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

create unique index if not exists profiles_phone_number_unique_idx
  on public.profiles (phone_number)
  where phone_number is not null;

create table if not exists public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'landing_page',
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint newsletter_subscriptions_email_format
    check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

alter table public.newsletter_subscriptions enable row level security;

drop policy if exists "admins read newsletter subscriptions" on public.newsletter_subscriptions;
create policy "admins read newsletter subscriptions" on public.newsletter_subscriptions
  for select to authenticated using (public.is_admin());

drop policy if exists "service role manages newsletter subscriptions" on public.newsletter_subscriptions;
create policy "service role manages newsletter subscriptions" on public.newsletter_subscriptions
  for all to service_role using (true) with check (true);

grant select, insert, update on public.newsletter_subscriptions to service_role;
