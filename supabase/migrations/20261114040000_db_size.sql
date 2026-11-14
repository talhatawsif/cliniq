-- Database size in bytes for the deep health check (/api/health?deep=1). Server (service_role) only.
create or replace function public.db_size() returns bigint
language sql security definer set search_path = '' as $$
  select pg_database_size(current_database());
$$;
revoke all on function public.db_size() from public, anon, authenticated;
grant execute on function public.db_size() to service_role;
