-- Phase 3 foundation: every dashboard operation is a SECURITY DEFINER function guarded by the caller's own JWT
-- (users.is_admin + role), honouring the "require MFA" switch. No service_role needed for these.

-- 1) Guards -------------------------------------------------------------------------------------------------
create or replace function public._require_admin()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_mfa boolean;
begin
  if auth.uid() is null
     or not exists (select 1 from public.users u
                     where u.id = auth.uid() and u.is_admin
                       and u.deleted_at is null and coalesce(u.status, 'active') = 'active') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce((select (value)::text::boolean from public.app_settings where key = 'dashboard_require_mfa'), false)
    into v_mfa;
  if v_mfa and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'MFA_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._require_owner()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public._require_admin();
  if not exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.admin_role, 'owner') = 'owner') then
    raise exception 'OWNER_ONLY' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public._require_admin() from public, anon, authenticated;
revoke all on function public._require_owner() from public, anon, authenticated;

-- 2) User picker (name / phone / e-mail) ---------------------------------------------------------------------
create or replace function public.admin_find_users(p_q text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_q text := btrim(coalesce(p_q, ''));
  v_like text;
  v_digits text;
begin
  perform public._require_admin();
  if length(v_q) < 2 then
    return '[]'::jsonb;
  end if;
  v_like := '%' || regexp_replace(v_q, '([\\%_])', '\\\1', 'g') || '%';
  v_digits := regexp_replace(regexp_replace(regexp_replace(v_q, '\D', '', 'g'), '^00963', ''), '^(963|0+)', '');

  return coalesce((
    select jsonb_agg(x.j)
    from (
      select jsonb_build_object(
               'id', u.id, 'name', coalesce(nullif(u.full_name, ''), '—'), 'phone', u.phone,
               'email', au.email, 'is_provider', u.is_provider, 'status', u.status,
               'deleted', u.deleted_at is not null) as j
        from public.users u
        left join auth.users au on au.id = u.id
       where u.full_name ilike v_like
          or au.email ilike v_like
          or (length(v_digits) >= 3 and u.phone like '%' || v_digits || '%')
       order by u.created_at desc
       limit 10
    ) x), '[]'::jsonb);
end;
$$;

-- 3) Full user file ------------------------------------------------------------------------------------------
create or replace function public.admin_get_user(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_u public.users;
  v_au auth.users;
begin
  perform public._require_admin();
  select * into v_u from public.users where id = p_user;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_au from auth.users where id = p_user;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin_view_user', 'user', p_user, '{}'::jsonb);

  return jsonb_build_object(
    'id', v_u.id,
    'name', v_u.full_name,
    'email', v_au.email,
    'phone', v_u.phone,
    'phone_verified', v_u.phone_verified_at is not null,
    'region', v_u.region,
    'status', v_u.status,
    'deleted_at', v_u.deleted_at,
    'is_provider', v_u.is_provider,
    'is_admin', v_u.is_admin,
    'admin_role', v_u.admin_role,
    'verification_status', v_u.verification_status::text,
    'created_at', v_u.created_at,
    'last_sign_in_at', v_au.last_sign_in_at,
    'rating_avg', v_u.rating_avg,
    'rating_count', v_u.rating_count,
    'wallet_balance', (select w.available_balance from public.wallets w where w.user_id = p_user),
    'requests_as_customer', (select count(*) from public.service_requests sr where sr.requester_id = p_user),
    'agreements_as_provider', (select count(*) from public.agreements a where a.provider_id = p_user),
    'completed_as_provider', (select pp.completed_services_count from public.provider_profiles pp where pp.user_id = p_user),
    'reports_against', (select count(*) from public.reports r where r.target_user_id = p_user),
    'reports_filed', (select count(*) from public.reports r where r.reporter_id = p_user),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('description', ps.description, 'active', ps.is_active,
                                          'city', ps.structured_data ->> 'city', 'area', ps.structured_data ->> 'area')
                       order by ps.created_at desc)
        from public.provider_services ps where ps.provider_id = p_user), '[]'::jsonb),
    'recent_requests', coalesce((
      select jsonb_agg(r2.j order by r2.created_at desc)
        from (select sr.created_at,
                     jsonb_build_object('id', sr.id, 'state', sr.state::text, 'text', left(sr.raw_text, 120),
                                        'created_at', sr.created_at) as j
                from public.service_requests sr where sr.requester_id = p_user
               order by sr.created_at desc limit 5) r2), '[]'::jsonb)
  );
end;
$$;

-- 4) Admin management (owner only) ---------------------------------------------------------------------------
create or replace function public.admin_list_admins()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', u.id, 'name', coalesce(nullif(u.full_name, ''), '—'), 'email', au.email,
             'role', coalesce(u.admin_role, 'owner'), 'status', u.status, 'created_at', u.created_at)
           order by u.created_at)
      from public.users u
      left join auth.users au on au.id = u.id
     where u.is_admin), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_admin_role(p_user uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_target public.users;
  v_before text;
  v_owner_count int;
begin
  perform public._require_owner();

  if p_role is not null and p_role not in ('owner', 'support', 'none') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if p_user = auth.uid() then
    raise exception 'CANNOT_CHANGE_SELF' using errcode = 'P0001';
  end if;

  select * into v_target from public.users where id = p_user for update;
  if not found or v_target.deleted_at is not null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if coalesce(v_target.status, 'active') <> 'active' and p_role in ('owner', 'support') then
    raise exception 'USER_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  v_before := case when v_target.is_admin then coalesce(v_target.admin_role, 'owner') else null end;

  -- never leave the system without an owner
  if v_before = 'owner' and coalesce(p_role, 'none') <> 'owner' then
    select count(*) into v_owner_count from public.users u
     where u.is_admin and coalesce(u.admin_role, 'owner') = 'owner' and u.id <> p_user and u.deleted_at is null;
    if v_owner_count = 0 then
      raise exception 'LAST_OWNER' using errcode = 'P0001';
    end if;
  end if;

  if p_role in ('owner', 'support') then
    update public.users set is_admin = true, admin_role = p_role where id = p_user;
  else
    update public.users set is_admin = false, admin_role = null where id = p_user;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin_set_admin_role', 'user', p_user,
          jsonb_build_object('from', v_before, 'to', case when p_role in ('owner', 'support') then p_role else null end));

  return jsonb_build_object('user_id', p_user, 'role', case when p_role in ('owner', 'support') then p_role else null end);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_find_users(text)', 'public.admin_get_user(uuid)',
    'public.admin_list_admins()', 'public.admin_set_admin_role(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;;
