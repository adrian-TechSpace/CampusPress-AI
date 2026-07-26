alter table public.profiles
  add column if not exists suspended_at timestamptz;

alter table public.profiles
  add column if not exists suspension_reason text;

create index if not exists profiles_role_suspended_idx
  on public.profiles (role, suspended_at);

create index if not exists comments_hidden_created_idx
  on public.comments (is_hidden, created_at desc);

create index if not exists payments_status_created_idx
  on public.payments (status, created_at desc);

create unique index if not exists subscriptions_user_provider_unique_idx
  on public.subscriptions (user_id, provider);

create index if not exists ai_usage_log_created_idx
  on public.ai_usage_log (created_at desc);

create or replace function public.is_suspended(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = profile_id
      and suspended_at is not null
  );
$$;

drop policy if exists "journalists create own articles" on public.articles;
create policy "journalists create own articles" on public.articles
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and not public.is_suspended((select auth.uid()))
  );

drop policy if exists "authors update own drafts and editors manage articles" on public.articles;
create policy "authors update own drafts and editors manage articles" on public.articles
  for update to authenticated
  using (
    (author_id = (select auth.uid()) and not public.is_suspended((select auth.uid())))
    or public.is_editor()
  )
  with check (
    (author_id = (select auth.uid()) and not public.is_suspended((select auth.uid())))
    or public.is_editor()
  );

drop policy if exists "authenticated users write own comments" on public.comments;
create policy "authenticated users write own comments" on public.comments
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and public.article_is_published(article_id)
    and not public.is_suspended((select auth.uid()))
  );
