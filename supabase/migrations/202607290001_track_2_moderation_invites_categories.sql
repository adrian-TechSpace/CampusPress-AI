do $$
begin
  alter type public.user_role add value if not exists 'subadmin';
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.account_moderation_status as enum ('active', 'warned', 'suspended', 'banned');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.suspension_appeal_status as enum ('submitted', 'accepted', 'rejected');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.account_invitation_status as enum ('pending', 'accepted', 'revoked');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists account_status public.account_moderation_status not null default 'active',
  add column if not exists session_version integer not null default 0,
  add column if not exists active_warning_action_id uuid,
  add column if not exists warning_acknowledged_at timestamptz,
  add column if not exists suspended_until timestamptz,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_reason text,
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by uuid references public.profiles(id) on delete set null,
  add column if not exists onboarding_completed_at timestamptz;

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('warn', 'suspend', 'ban', 'restore', 'appeal_accept', 'appeal_reject')),
  reason_code text,
  reason_text text not null default '',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_active_warning_action_id_fkey;

alter table public.profiles
  add constraint profiles_active_warning_action_id_fkey
  foreign key (active_warning_action_id) references public.moderation_actions(id) on delete set null;

create table if not exists public.suspension_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  suspension_action_id uuid references public.moderation_actions(id) on delete set null,
  status public.suspension_appeal_status not null default 'submitted',
  answers jsonb not null default '{}'::jsonb,
  explanation text not null,
  id_photo_path text not null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text
);

create table if not exists public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null,
  status public.account_invitation_status not null default 'pending',
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  onboarding_completed_at timestamptz,
  orientation jsonb not null default '{}'::jsonb,
  constraint account_invitations_admin_tier_role check (role::text in ('editor', 'admin', 'subadmin'))
);

create index if not exists moderation_actions_target_created_idx
  on public.moderation_actions (target_user_id, created_at desc);

create index if not exists profiles_account_status_idx
  on public.profiles (account_status, suspended_until, banned_at);

create unique index if not exists suspension_appeals_one_pending_idx
  on public.suspension_appeals (user_id)
  where status = 'submitted'::public.suspension_appeal_status;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'appeal-ids',
  'appeal-ids',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_full_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role::text = 'admin'
  );
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
      and role::text in ('admin', 'subadmin')
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
      and role::text in ('editor', 'admin', 'subadmin')
  );
$$;

create or replace function public.is_account_blocked(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = profile_id
      and (
        account_status::text = 'banned'
        or (
          account_status::text = 'suspended'
          and (suspended_until is null or suspended_until > now())
        )
      )
  );
$$;

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
      and account_status::text = 'suspended'
      and (suspended_until is null or suspended_until > now())
  );
$$;

update public.profiles
set
  account_status = 'suspended',
  suspended_until = coalesce(suspended_until, '9999-12-31 23:59:59+00'::timestamptz)
where suspended_at is not null
  and account_status::text = 'active';

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (
    id = (select auth.uid())
    and role::text in ('reader', 'journalist')
    and verified is false
    and verified_at is null
  );

drop policy if exists "users update own non privileged profile" on public.profiles;
create policy "users update own non privileged profile" on public.profiles
  for update to authenticated
  using (
    (
      id = (select auth.uid())
      and not public.is_account_blocked((select auth.uid()))
    )
    or public.is_admin()
  )
  with check (
    (
      id = (select auth.uid())
      and not public.is_account_blocked((select auth.uid()))
      and public.can_update_own_profile(role, verified, verified_at)
    )
    or public.is_admin()
  );

drop policy if exists "journalists create own articles" on public.articles;
create policy "journalists create own articles" on public.articles
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and not public.is_account_blocked((select auth.uid()))
  );

drop policy if exists "authors update own drafts and editors manage articles" on public.articles;
create policy "authors update own drafts and editors manage articles" on public.articles
  for update to authenticated
  using (
    (
      author_id = (select auth.uid())
      and not public.is_account_blocked((select auth.uid()))
    )
    or public.is_editor()
  )
  with check (
    (
      author_id = (select auth.uid())
      and not public.is_account_blocked((select auth.uid()))
    )
    or public.is_editor()
  );

drop policy if exists "authors delete own unpublished articles" on public.articles;
create policy "authors delete own unpublished articles" on public.articles
  for delete to authenticated using (
    (
      author_id = (select auth.uid())
      and status <> 'published'
      and not public.is_account_blocked((select auth.uid()))
    )
    or public.is_admin()
  );

drop policy if exists "authenticated users write own comments" on public.comments;
create policy "authenticated users write own comments" on public.comments
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and public.article_is_published(article_id)
    and not public.is_account_blocked((select auth.uid()))
  );

drop policy if exists "comment owners and editors update comments" on public.comments;
create policy "comment owners and editors update comments" on public.comments
  for update to authenticated
  using (
    (
      author_id = (select auth.uid())
      and not public.is_account_blocked((select auth.uid()))
    )
    or public.is_editor()
  )
  with check (
    (
      author_id = (select auth.uid())
      and not public.is_account_blocked((select auth.uid()))
    )
    or public.is_editor()
  );

drop policy if exists "users send own messages" on public.messages;
create policy "users send own messages" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and not public.is_account_blocked((select auth.uid()))
  );

drop policy if exists "editors create notifications" on public.notifications;
create policy "editors create notifications" on public.notifications
  for insert to authenticated with check (
    (public.is_editor() or actor_id = (select auth.uid()))
    and not public.is_account_blocked((select auth.uid()))
  );

drop policy if exists "users manage own bookmarks" on public.bookmarks;
create policy "users manage own bookmarks" on public.bookmarks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and not public.is_account_blocked((select auth.uid()))
  );

drop policy if exists "users manage own follows" on public.follows;
create policy "users manage own follows" on public.follows
  for all to authenticated
  using (follower_id = (select auth.uid()))
  with check (
    follower_id = (select auth.uid())
    and not public.is_account_blocked((select auth.uid()))
  );

drop policy if exists "users manage own likes" on public.article_likes;
create policy "users manage own likes" on public.article_likes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and not public.is_account_blocked((select auth.uid()))
  );

drop policy if exists "users manage own interests" on public.user_interests;
create policy "users manage own interests" on public.user_interests
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and not public.is_account_blocked((select auth.uid()))
  );

do $$
begin
  execute 'alter table public.moderation_actions enable row level security';
  execute 'alter table public.suspension_appeals enable row level security';
  execute 'alter table public.account_invitations enable row level security';
end $$;

drop policy if exists "admins read moderation actions" on public.moderation_actions;
create policy "admins read moderation actions" on public.moderation_actions
  for select to authenticated using (public.is_admin());

drop policy if exists "admins insert moderation actions" on public.moderation_actions;
create policy "admins insert moderation actions" on public.moderation_actions
  for insert to authenticated with check (public.is_admin());

drop policy if exists "users and admins read appeals" on public.suspension_appeals;
create policy "users and admins read appeals" on public.suspension_appeals
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "suspended users submit appeals" on public.suspension_appeals;
create policy "suspended users submit appeals" on public.suspension_appeals
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public.is_suspended((select auth.uid()))
  );

drop policy if exists "admins update appeals" on public.suspension_appeals;
create policy "admins update appeals" on public.suspension_appeals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage invitations" on public.account_invitations;
create policy "admins manage invitations" on public.account_invitations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "appeal id photos are private" on storage.objects;
create policy "appeal id photos are private"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'appeal-ids'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
    )
  );

insert into public.categories (name, slug, description)
values
  ('Campus News', 'campus-news', 'Official stories, notices, and events from campus life.'),
  ('Campus Life', 'campus-life', 'Student routines, campus services, clubs, and daily life.'),
  ('Academics', 'academics', 'Classroom, department, assessment, and study coverage.'),
  ('Investigations', 'investigations', 'Reported accountability stories with clear evidence.'),
  ('Opinion', 'opinion', 'Student and lecturer commentary with clear attribution.'),
  ('Student Government', 'student-government', 'Student representation, elections, and campus governance.'),
  ('Features', 'features', 'Long-form reporting, interviews, and profiles.'),
  ('Research', 'research', 'Academic work, innovation, and department updates.'),
  ('Sports', 'sports', 'Chrisland sports coverage and results.')
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description;
