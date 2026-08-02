drop view if exists public.public_profiles;

create view public.public_profiles as
select
  profiles.id,
  profiles.full_name,
  profiles.username,
  profiles.role,
  profiles.bio,
  profiles.avatar_url,
  profiles.verified,
  profiles.verified_at,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'name', achievements.name,
          'slug', achievements.slug,
          'description', achievements.description,
          'badge_tone', achievements.badge_tone,
          'awarded_at', user_achievements.awarded_at
        )
        order by user_achievements.awarded_at desc
      )
      from public.user_achievements
      join public.achievements on achievements.id = user_achievements.achievement_id
      where user_achievements.user_id = profiles.id
    ),
    '[]'::jsonb
  ) as achievement_badges
from public.profiles
where profiles.username is not null;

revoke all on public.profiles from anon;
grant select on public.public_profiles to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.profiles to service_role;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profile owners and admins read raw profiles" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin()
  );
