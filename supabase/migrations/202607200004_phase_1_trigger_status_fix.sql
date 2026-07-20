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
      c.oid is not null as table_present,
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
      count(*) filter (where t.tgname = 'profiles_roster_cross_check') = 1 as profile_trigger_present,
      count(*) filter (where t.tgname = 'institution_roster_cross_check') = 1 as roster_trigger_present
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
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
    'all_tables_present', (select bool_and(table_present) from table_status),
    'all_rls_enabled', (select bool_and(rls_enabled) from table_status),
    'missing_tables', coalesce((select jsonb_agg(table_name) from table_status where table_present is false), '[]'::jsonb),
    'rls_disabled_tables', coalesce((select jsonb_agg(table_name) from table_status where table_present is true and rls_enabled is false), '[]'::jsonb),
    'verified_columns_present', (select verified_present and verified_at_present from profile_columns),
    'roster_triggers_present', (select profile_trigger_present and roster_trigger_present from trigger_status),
    'roster_function_present', (select roster_function_present from function_status)
  );
$$;
