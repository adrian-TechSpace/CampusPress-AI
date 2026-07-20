grant usage on schema public to anon, authenticated, service_role;

grant select on
  public.institutions,
  public.profiles,
  public.categories,
  public.articles,
  public.comments,
  public.ad_placements,
  public.achievements,
  public.user_achievements
to anon;

grant all privileges on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all privileges on tables to authenticated;
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant execute on functions to authenticated;
alter default privileges in schema public grant execute on functions to service_role;
