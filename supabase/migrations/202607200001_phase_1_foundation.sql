create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.user_role as enum ('reader', 'journalist', 'editor', 'admin');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.article_status as enum ('draft', 'submitted', 'in_review', 'revision_requested', 'approved', 'rejected', 'published', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.analysis_status as enum ('pending', 'running', 'completed', 'partial', 'failed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
exception when duplicate_object then null;
end $$;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  motto text not null default 'Intellectual Radiance',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  email text not null,
  full_name text not null,
  role public.user_role not null default 'reader',
  department_code text not null,
  entry_year integer,
  matric_or_staff_id text not null,
  bio text,
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb,
  article_count integer not null default 0,
  credibility_score numeric(5,2) not null default 0,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_department_code_format check (department_code ~ '^[A-Z]{2,4}$'),
  constraint profiles_identifier_format check (matric_or_staff_id ~ '^[A-Z]{2,4}/[0-9]{4}/[0-9]{3}$')
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  editor_id uuid references public.profiles(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  excerpt text,
  content jsonb not null default '{}'::jsonb,
  plain_text text not null default '',
  featured_image_url text,
  featured_image_alt text,
  status public.article_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_non_empty_title check (length(trim(title)) > 0)
);

create index if not exists articles_plain_text_trgm_idx on public.articles using gin (plain_text extensions.gin_trgm_ops);
create index if not exists articles_status_published_idx on public.articles (status, published_at desc);
create index if not exists articles_author_idx on public.articles (author_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid references public.articles(id) on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_participants_idx on public.messages (sender_id, recipient_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  article_id uuid references public.articles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create table if not exists public.article_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, article_id)
);

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  provider text not null,
  model_name text not null,
  model_family text not null,
  status public.analysis_status not null default 'pending',
  verdict text,
  confidence numeric(5,2),
  score numeric(5,2),
  flagged_sentences jsonb not null default '[]'::jsonb,
  raw_output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_analyses_article_idx on public.ai_analyses (article_id, created_at desc);

create table if not exists public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  placement_key text not null unique,
  advertiser_name text,
  target_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'paystack',
  provider_customer_id text,
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'paystack',
  provider_reference text unique,
  amount_kobo integer not null default 0,
  currency text not null default 'NGN',
  status public.payment_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  weight numeric(5,2) not null default 1,
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null,
  badge_tone text not null default 'standard',
  created_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.profiles(id) on delete set null,
  unique (user_id, achievement_id)
);

create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  article_id uuid references public.articles(id) on delete cascade,
  provider text not null,
  model_name text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  cost_cents numeric(10,4) not null default 0,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.job_run_log (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  error_message text
);

create table if not exists public.institution_roster (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  department_code text not null,
  matric_or_staff_id text not null,
  full_name text not null,
  role public.user_role not null default 'reader',
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  matched_profile_id uuid references public.profiles(id) on delete set null,
  matched_at timestamptz,
  unique (department_code, matric_or_staff_id),
  constraint institution_roster_department_code_format check (department_code ~ '^[A-Z]{2,4}$'),
  constraint institution_roster_identifier_format check (matric_or_staff_id ~ '^[A-Z]{2,4}/[0-9]{4}/[0-9]{3}$')
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('editor', 'admin')
  );
$$;

create or replace function public.can_update_own_profile(next_role public.user_role, next_verified boolean, next_verified_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = next_role
      and verified = next_verified
      and verified_at is not distinct from next_verified_at
  );
$$;

create or replace function public.run_roster_cross_check(target_profile_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_count integer := 0;
begin
  update public.profiles p
  set verified = true,
      verified_at = coalesce(p.verified_at, now()),
      updated_at = now()
  from public.institution_roster r
  where p.department_code = r.department_code
    and p.matric_or_staff_id = r.matric_or_staff_id
    and (target_profile_id is null or p.id = target_profile_id)
    and p.verified is false;

  get diagnostics matched_count = row_count;

  update public.institution_roster r
  set matched_profile_id = p.id,
      matched_at = coalesce(r.matched_at, now())
  from public.profiles p
  where p.department_code = r.department_code
    and p.matric_or_staff_id = r.matric_or_staff_id
    and (target_profile_id is null or p.id = target_profile_id)
    and r.matched_profile_id is distinct from p.id;

  insert into public.job_run_log (job_name, status, ended_at, metadata)
  values (
    'roster-cross-check',
    'completed',
    now(),
    jsonb_build_object('target_profile_id', target_profile_id, 'matched_profiles', matched_count)
  );

  return jsonb_build_object('matched_profiles', matched_count);
exception when others then
  insert into public.job_run_log (job_name, status, ended_at, error_message, metadata)
  values ('roster-cross-check', 'failed', now(), sqlerrm, jsonb_build_object('target_profile_id', target_profile_id));
  raise;
end;
$$;

create or replace function public.handle_profile_roster_cross_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.run_roster_cross_check(new.id);
  return new;
end;
$$;

create or replace function public.handle_roster_cross_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.run_roster_cross_check(null);
  return new;
end;
$$;

create or replace function public.handle_article_publish_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    update public.profiles
    set article_count = article_count + 1,
        updated_at = now()
    where id = new.author_id;
  end if;
  return new;
end;
$$;

create or replace function public.recalculate_profile_credibility(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_score numeric(5,2);
begin
  select coalesce(round(avg(coalesce(a.score, a.confidence, 0))::numeric, 2), 0)
  into next_score
  from public.articles ar
  join public.ai_analyses a on a.article_id = ar.id
  where ar.author_id = target_profile_id
    and a.status in ('completed', 'partial');

  update public.profiles
  set credibility_score = least(100, greatest(0, next_score)),
      updated_at = now()
  where id = target_profile_id;
end;
$$;

create or replace function public.handle_ai_analysis_credibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_author_id uuid;
begin
  select author_id into target_author_id
  from public.articles
  where id = coalesce(new.article_id, old.article_id);

  if target_author_id is not null then
    perform public.recalculate_profile_credibility(target_author_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  record_uuid uuid;
begin
  record_uuid := coalesce(new.id, old.id);

  insert into public.audit_log (actor_id, action, table_name, record_id, before_data, after_data)
  values ((select auth.uid()), tg_op, tg_table_name, record_uuid, to_jsonb(old), to_jsonb(new));

  return coalesce(new, old);
end;
$$;

create or replace function public.article_is_published(article_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.articles
    where id = article_uuid
      and status = 'published'
  );
$$;

create or replace function public.article_is_owned(article_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.articles
    where id = article_uuid
      and author_id = (select auth.uid())
  );
$$;

create or replace function public.phase1_foundation_remote_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with required_tables(table_name) as (
    values
      ('profiles'),
      ('institutions'),
      ('articles'),
      ('comments'),
      ('messages'),
      ('notifications'),
      ('bookmarks'),
      ('follows'),
      ('article_likes'),
      ('ai_analyses'),
      ('ad_placements'),
      ('subscriptions'),
      ('payments'),
      ('audit_log'),
      ('user_interests'),
      ('categories'),
      ('achievements'),
      ('user_achievements'),
      ('ai_usage_log'),
      ('job_run_log'),
      ('institution_roster')
  ),
  table_status as (
    select
      rt.table_name,
      coalesce(c.relrowsecurity, false) as rls_enabled
    from required_tables rt
    left join pg_class c on c.relname = rt.table_name
    left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  ),
  profile_columns as (
    select
      count(*) filter (where column_name = 'verified' and data_type = 'boolean') = 1 as verified_present,
      count(*) filter (where column_name = 'verified_at' and data_type = 'timestamp with time zone') = 1 as verified_at_present
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('verified', 'verified_at')
  ),
  trigger_status as (
    select
      count(*) filter (where trigger_name = 'profiles_roster_cross_check') = 1 as profile_trigger_present,
      count(*) filter (where trigger_name = 'institution_roster_cross_check') = 1 as roster_trigger_present
    from information_schema.triggers
    where event_object_schema = 'public'
  ),
  function_status as (
    select
      count(*) filter (where proname = 'run_roster_cross_check') = 1 as roster_function_present
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  )
  select jsonb_build_object(
    'required_table_count', (select count(*) from table_status),
    'all_tables_present', (select count(*) = 21 from table_status where rls_enabled is not null),
    'all_rls_enabled', (select bool_and(rls_enabled) from table_status),
    'missing_tables', coalesce((select jsonb_agg(table_name) from table_status where rls_enabled is null), '[]'::jsonb),
    'rls_disabled_tables', coalesce((select jsonb_agg(table_name) from table_status where rls_enabled is false), '[]'::jsonb),
    'verified_columns_present', (select verified_present and verified_at_present from profile_columns),
    'roster_triggers_present', (select profile_trigger_present and roster_trigger_present from trigger_status),
    'roster_function_present', (select roster_function_present from function_status)
  );
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'institutions',
    'profiles',
    'categories',
    'articles',
    'comments',
    'messages',
    'notifications',
    'bookmarks',
    'follows',
    'article_likes',
    'ai_analyses',
    'ad_placements',
    'subscriptions',
    'payments',
    'audit_log',
    'user_interests',
    'achievements',
    'user_achievements',
    'ai_usage_log',
    'job_run_log',
    'institution_roster'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop policy if exists "institutions are publicly readable" on public.institutions;
create policy "institutions are publicly readable" on public.institutions
  for select using (true);

drop policy if exists "admins manage institutions" on public.institutions;
create policy "admins manage institutions" on public.institutions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
  for select using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (
    id = (select auth.uid())
    and role in ('reader', 'journalist')
    and verified is false
    and verified_at is null
  );

drop policy if exists "users update own non privileged profile" on public.profiles;
create policy "users update own non privileged profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (
    (id = (select auth.uid()) and public.can_update_own_profile(role, verified, verified_at))
    or public.is_admin()
  );

drop policy if exists "categories are publicly readable" on public.categories;
create policy "categories are publicly readable" on public.categories
  for select using (true);

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "published articles are public" on public.articles;
create policy "published articles are public" on public.articles
  for select using (status = 'published' or author_id = (select auth.uid()) or public.is_editor());

drop policy if exists "journalists create own articles" on public.articles;
create policy "journalists create own articles" on public.articles
  for insert to authenticated with check (author_id = (select auth.uid()));

drop policy if exists "authors update own drafts and editors manage articles" on public.articles;
create policy "authors update own drafts and editors manage articles" on public.articles
  for update to authenticated
  using (author_id = (select auth.uid()) or public.is_editor())
  with check (author_id = (select auth.uid()) or public.is_editor());

drop policy if exists "authors delete own unpublished articles" on public.articles;
create policy "authors delete own unpublished articles" on public.articles
  for delete to authenticated using ((author_id = (select auth.uid()) and status <> 'published') or public.is_admin());

drop policy if exists "comments visible on public or own articles" on public.comments;
create policy "comments visible on public or own articles" on public.comments
  for select using (not is_hidden and (public.article_is_published(article_id) or public.article_is_owned(article_id) or public.is_editor()));

drop policy if exists "authenticated users write own comments" on public.comments;
create policy "authenticated users write own comments" on public.comments
  for insert to authenticated with check (author_id = (select auth.uid()) and public.article_is_published(article_id));

drop policy if exists "comment owners and editors update comments" on public.comments;
create policy "comment owners and editors update comments" on public.comments
  for update to authenticated using (author_id = (select auth.uid()) or public.is_editor()) with check (author_id = (select auth.uid()) or public.is_editor());

drop policy if exists "comment owners and editors delete comments" on public.comments;
create policy "comment owners and editors delete comments" on public.comments
  for delete to authenticated using (author_id = (select auth.uid()) or public.is_editor());

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages
  for select to authenticated using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()) or public.is_admin());

drop policy if exists "users send own messages" on public.messages;
create policy "users send own messages" on public.messages
  for insert to authenticated with check (sender_id = (select auth.uid()));

drop policy if exists "recipients mark messages read" on public.messages;
create policy "recipients mark messages read" on public.messages
  for update to authenticated using (recipient_id = (select auth.uid()) or public.is_admin()) with check (recipient_id = (select auth.uid()) or public.is_admin());

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications
  for update to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "editors create notifications" on public.notifications;
create policy "editors create notifications" on public.notifications
  for insert to authenticated with check (public.is_editor() or actor_id = (select auth.uid()));

drop policy if exists "users manage own bookmarks" on public.bookmarks;
create policy "users manage own bookmarks" on public.bookmarks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "users manage own follows" on public.follows;
create policy "users manage own follows" on public.follows
  for all to authenticated using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()));

drop policy if exists "users manage own likes" on public.article_likes;
create policy "users manage own likes" on public.article_likes
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "article authors and editors read analyses" on public.ai_analyses;
create policy "article authors and editors read analyses" on public.ai_analyses
  for select to authenticated using (
    public.is_editor() or exists (
      select 1 from public.articles
      where articles.id = ai_analyses.article_id
        and articles.author_id = (select auth.uid())
    )
  );

drop policy if exists "editors request analyses" on public.ai_analyses;
create policy "editors request analyses" on public.ai_analyses
  for insert to authenticated with check (public.is_editor() or requested_by = (select auth.uid()));

drop policy if exists "editors update analyses" on public.ai_analyses;
create policy "editors update analyses" on public.ai_analyses
  for update to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists "active ads are public" on public.ad_placements;
create policy "active ads are public" on public.ad_placements
  for select using (is_active or public.is_admin());

drop policy if exists "admins manage ads" on public.ad_placements;
create policy "admins manage ads" on public.ad_placements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users read own subscriptions" on public.subscriptions;
create policy "users read own subscriptions" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "admins manage subscriptions" on public.subscriptions;
create policy "admins manage subscriptions" on public.subscriptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users read own payments" on public.payments;
create policy "users read own payments" on public.payments
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "admins manage payments" on public.payments;
create policy "admins manage payments" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read audit log" on public.audit_log;
create policy "admins read audit log" on public.audit_log
  for select to authenticated using (public.is_admin());

drop policy if exists "admins insert audit log" on public.audit_log;
create policy "admins insert audit log" on public.audit_log
  for insert to authenticated with check (public.is_admin());

drop policy if exists "users manage own interests" on public.user_interests;
create policy "users manage own interests" on public.user_interests
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "achievements are public" on public.achievements;
create policy "achievements are public" on public.achievements
  for select using (true);

drop policy if exists "admins manage achievements" on public.achievements;
create policy "admins manage achievements" on public.achievements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "user achievements are public" on public.user_achievements;
create policy "user achievements are public" on public.user_achievements
  for select using (true);

drop policy if exists "admins manage user achievements" on public.user_achievements;
create policy "admins manage user achievements" on public.user_achievements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read ai usage" on public.ai_usage_log;
create policy "admins read ai usage" on public.ai_usage_log
  for select to authenticated using (public.is_admin());

drop policy if exists "editors create ai usage" on public.ai_usage_log;
create policy "editors create ai usage" on public.ai_usage_log
  for insert to authenticated with check (public.is_editor());

drop policy if exists "editors read job runs" on public.job_run_log;
create policy "editors read job runs" on public.job_run_log
  for select to authenticated using (public.is_editor());

drop policy if exists "admins manage job runs" on public.job_run_log;
create policy "admins manage job runs" on public.job_run_log
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "editors read roster" on public.institution_roster;
create policy "editors read roster" on public.institution_roster
  for select to authenticated using (public.is_editor());

drop policy if exists "admins manage roster" on public.institution_roster;
create policy "admins manage roster" on public.institution_roster
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists institutions_updated_at on public.institutions;
create trigger institutions_updated_at before update on public.institutions
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists articles_updated_at on public.articles;
create trigger articles_updated_at before update on public.articles
  for each row execute function public.set_updated_at();

drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

drop trigger if exists ad_placements_updated_at on public.ad_placements;
create trigger ad_placements_updated_at before update on public.ad_placements
  for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_roster_cross_check on public.profiles;
create trigger profiles_roster_cross_check after insert or update of department_code, matric_or_staff_id on public.profiles
  for each row execute function public.handle_profile_roster_cross_check();

drop trigger if exists institution_roster_cross_check on public.institution_roster;
create trigger institution_roster_cross_check after insert or update of department_code, matric_or_staff_id on public.institution_roster
  for each row execute function public.handle_roster_cross_check();

drop trigger if exists articles_publish_count on public.articles;
create trigger articles_publish_count after insert or update of status on public.articles
  for each row execute function public.handle_article_publish_count();

drop trigger if exists ai_analyses_recalculate_credibility on public.ai_analyses;
create trigger ai_analyses_recalculate_credibility after insert or update or delete on public.ai_analyses
  for each row execute function public.handle_ai_analysis_credibility();

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after update or delete on public.profiles
  for each row execute function public.write_audit_log();

drop trigger if exists articles_audit on public.articles;
create trigger articles_audit after insert or update or delete on public.articles
  for each row execute function public.write_audit_log();

drop trigger if exists payments_audit on public.payments;
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function public.write_audit_log();

drop trigger if exists subscriptions_audit on public.subscriptions;
create trigger subscriptions_audit after insert or update or delete on public.subscriptions
  for each row execute function public.write_audit_log();

drop trigger if exists ad_placements_audit on public.ad_placements;
create trigger ad_placements_audit after insert or update or delete on public.ad_placements
  for each row execute function public.write_audit_log();

drop trigger if exists institution_roster_audit on public.institution_roster;
create trigger institution_roster_audit after insert or update or delete on public.institution_roster
  for each row execute function public.write_audit_log();

insert into public.institutions (name, slug, motto)
values ('Chrisland University', 'chrisland-university', 'Intellectual Radiance')
on conflict (slug) do nothing;

insert into public.categories (name, slug, description)
values
  ('Campus News', 'campus-news', 'Official stories, notices, and events from campus life.'),
  ('Opinion', 'opinion', 'Student and lecturer commentary with clear attribution.'),
  ('Features', 'features', 'Long-form reporting, interviews, and profiles.'),
  ('Research', 'research', 'Academic work, innovation, and department updates.'),
  ('Sports', 'sports', 'Chrisland sports coverage and results.')
on conflict (slug) do nothing;

insert into public.achievements (name, slug, description, badge_tone)
values
  ('Verified Chrisland Identity', 'verified-chrisland-identity', 'Awarded when a roster upload confirms the user identity.', 'gold'),
  ('Published Reporter', 'published-reporter', 'Awarded after a journalist publishes their first article.', 'standard'),
  ('Credibility Builder', 'credibility-builder', 'Awarded for consistently credible reporting.', 'standard')
on conflict (slug) do nothing;
