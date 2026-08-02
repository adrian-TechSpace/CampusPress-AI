create table if not exists public.profile_public_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  show_liked_articles boolean not null default false,
  show_public_comments boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_public_settings_liked_idx
  on public.profile_public_settings (show_liked_articles)
  where show_liked_articles is true;

create index if not exists profile_public_settings_comments_idx
  on public.profile_public_settings (show_public_comments)
  where show_public_comments is true;

create index if not exists follows_following_created_idx
  on public.follows (following_id, created_at desc);

alter table public.profile_public_settings enable row level security;

drop policy if exists "public reads portfolio settings" on public.profile_public_settings;
create policy "public reads portfolio settings" on public.profile_public_settings
  for select using (true);

drop policy if exists "profile owners manage public settings" on public.profile_public_settings;
create policy "profile owners manage public settings" on public.profile_public_settings
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

grant select on public.profile_public_settings to anon, authenticated;
grant insert, update, delete on public.profile_public_settings to authenticated;
grant all on public.profile_public_settings to service_role;
