revoke execute on function public.run_roster_cross_check(uuid) from public;
revoke execute on function public.run_roster_cross_check(uuid) from anon;
revoke execute on function public.run_roster_cross_check(uuid) from authenticated;

grant execute on function public.run_roster_cross_check(uuid) to service_role;
