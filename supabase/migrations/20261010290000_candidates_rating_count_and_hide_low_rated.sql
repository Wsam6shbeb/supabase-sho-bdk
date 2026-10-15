-- 1) Candidate lists expose rating_count (so the UI can show "جديد" for providers with no real ratings yet).
-- 2) Providers with a low general rating (after enough real ratings) are hidden from matching.
--    Thresholds live in app_settings: hide_provider_below_rating (default 3) and hide_provider_min_ratings (default 5).

insert into public.app_settings (key, value) values
  ('hide_provider_below_rating', '3'::jsonb),
  ('hide_provider_min_ratings', '5'::jsonb)
on conflict (key) do nothing;

drop function if exists public.get_request_candidates(uuid);
create function public.get_request_candidates(p_request_id uuid)
returns table(provider_id uuid, rank integer, match_score numeric, rating_avg numeric, rating_count integer,
              completed_services_count integer, full_name text, avatar_url text, region text, verification_status text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    c.provider_id,
    c.rank,
    c.match_score,
    pp.rating_avg,
    pp.rating_count,
    pp.completed_services_count,
    u.full_name,
    u.avatar_url,
    u.region,
    u.verification_status::text
  from public.candidates c
  join public.service_requests sr on sr.id = c.request_id
  join public.provider_profiles pp on pp.user_id = c.provider_id
  join public.users u on u.id = c.provider_id
  where c.request_id = p_request_id
    and sr.requester_id = auth.uid()
  order by c.rank asc;
$function$;
revoke all on function public.get_request_candidates(uuid) from public, anon;
grant execute on function public.get_request_candidates(uuid) to authenticated;

-- Transform the CURRENT definition of get_provider_candidates (keeps any other changes made to it).
do $$
declare
  d text;
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_provider_candidates';

  if position('RETURNS TABLE(provider_id uuid, rating_avg numeric, completed_services_count integer' in d) = 0
     or position('select c.provider_id,pp.rating_avg,pp.completed_services_count,u.full_name' in d) = 0
     or position('  where pp.is_available=true and pd.provider_id<>(select requester_id from request_row)' in d) = 0 then
    raise exception 'get_provider_candidates definition changed; update this migration';
  end if;

  d := replace(d,
    'RETURNS TABLE(provider_id uuid, rating_avg numeric, completed_services_count integer',
    'RETURNS TABLE(provider_id uuid, rating_avg numeric, rating_count integer, completed_services_count integer');
  d := replace(d,
    'select c.provider_id,pp.rating_avg,pp.completed_services_count,u.full_name',
    'select c.provider_id,pp.rating_avg,pp.rating_count,pp.completed_services_count,u.full_name');
  d := replace(d,
    '  where pp.is_available=true and pd.provider_id<>(select requester_id from request_row)',
    '  where pp.is_available=true and pd.provider_id<>(select requester_id from request_row)' || E'\n' ||
    '    and not exists (select 1 from public.users ur where ur.id=pd.provider_id' || E'\n' ||
    '      and ur.rating_count >= coalesce((select (value)::text::integer from public.app_settings where key=''hide_provider_min_ratings''),5)' || E'\n' ||
    '      and ur.rating_avg < coalesce((select (value)::text::numeric from public.app_settings where key=''hide_provider_below_rating''),3))');

  drop function public.get_provider_candidates(uuid, integer);
  execute d;
end;
$$;
revoke all on function public.get_provider_candidates(uuid, integer) from public, anon;
grant execute on function public.get_provider_candidates(uuid, integer) to authenticated;
