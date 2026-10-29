-- Admin-initiated account deletion.
-- Anonymize the public profile and disable sign-in while retaining linked history
-- and verification records needed for safety, accounting, and audit purposes.

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_target public.users%rowtype;
  v_ongoing int;
begin
  if p_user_id is null then
    raise exception 'INVALID_USER_ID' using errcode = '22023';
  end if;

  select * into v_target
    from public.users
   where id = p_user_id
   for update;

  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_target.is_admin then
    raise exception 'ADMIN_ACCOUNT_PROTECTED' using errcode = '42501';
  end if;

  if v_target.deleted_at is not null or v_target.status = 'deleted' then
    raise exception 'USER_ALREADY_DELETED' using errcode = 'P0001';
  end if;

  -- Do not remove access while the person has active work with another user.
  select count(*) into v_ongoing
    from public.agreements a
    join public.service_requests sr on sr.id = a.request_id
   where (a.requester_id = p_user_id or a.provider_id = p_user_id)
     and (
       a.state = 'pending'
       or (a.state = 'active' and sr.state in ('active', 'agreement_pending_provider'))
     );

  if v_ongoing > 0 then
    raise exception 'ACTIVE_WORK_IN_PROGRESS' using errcode = 'P0001';
  end if;

  -- Remove personal/device data that can be safely deleted.
  delete from public.push_tokens where user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;
  delete from public.phone_shares where from_user_id = p_user_id;
  delete from public.provider_services where provider_id = p_user_id;

  -- Keep referenced rows so existing agreements and conversations remain valid.
  update public.provider_profiles
     set bio = null, is_available = false
   where user_id = p_user_id;

  -- Anonymize the profile. Keep verification, ratings, agreements, messages,
  -- wallet/ledger, and report records for safety and accounting purposes.
  update public.users
     set full_name = 'حساب محذوف',
         phone = null,
         region = null,
         avatar_url = null,
         is_provider = false,
         status = 'deleted',
         deleted_at = now()
   where id = p_user_id;

  -- Remove sign-in identities and sessions, then scrub and permanently ban Auth.
  delete from auth.identities where user_id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  update auth.users
     set email = 'deleted+' || id::text || '@deleted.invalid',
         phone = null,
         raw_user_meta_data = '{}'::jsonb,
         raw_app_meta_data = jsonb_build_object('deleted', true),
         banned_until = 'infinity'
   where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user(uuid) to service_role;
