-- Rollback لـ 20261115180000_delete_account_clear_display_name.sql
-- يعيد دالتي الحذف إلى التعريف السابق (بدون مسح الاسم المستعار). لا يعيد أسماء مستعارة تم مسحها.

create or replace function public.delete_my_account()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_ongoing int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- Refuse while there is work in progress with another person.
  select count(*) into v_ongoing
    from public.agreements a
    join public.service_requests sr on sr.id = a.request_id
   where (a.requester_id = v_uid or a.provider_id = v_uid)
     and (
       a.state = 'pending'
       or (a.state = 'active' and sr.state in ('active', 'agreement_pending_provider'))
     );
  if v_ongoing > 0 then
    raise exception 'ACTIVE_WORK_IN_PROGRESS' using errcode = 'P0001';
  end if;

  -- Personal data owned by the user: delete.
  delete from public.push_tokens where user_id = v_uid;
  delete from public.notifications where user_id = v_uid;
  delete from public.phone_shares where from_user_id = v_uid;
  -- verifications: kept on purpose (safety / legal requests). Do not delete.
  delete from public.provider_services where provider_id = v_uid;

  -- Provider profile row must stay (agreements/conversations reference it): clear text, stop matching.
  update public.provider_profiles set bio = null, is_available = false where user_id = v_uid;

  -- Public profile: anonymize.
  update public.users
     set full_name = 'حساب محذوف',
         phone = null,
         region = null,
         avatar_url = null,
         is_provider = false,
         deleted_at = now()
   where id = v_uid;

  -- Sign-in identity: scrub email/metadata (name, Google picture...), unlink Google, end all sessions, block login.
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;
  update auth.users
     set email = 'deleted+' || id::text || '@deleted.invalid',
         phone = null,
         raw_user_meta_data = '{}'::jsonb,
         raw_app_meta_data = jsonb_build_object('deleted', true),
         banned_until = 'infinity'
   where id = v_uid;
end;
$function$;

create or replace function public.admin_delete_user(p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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

  delete from public.push_tokens where user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;
  delete from public.phone_shares where from_user_id = p_user_id;
  delete from public.provider_services where provider_id = p_user_id;

  update public.provider_profiles
     set bio = null, is_available = false
   where user_id = p_user_id;

  update public.users
     set full_name = 'حساب محذوف',
         phone = null,
         region = null,
         avatar_url = null,
         is_provider = false,
         status = 'deleted',
         deleted_at = now()
   where id = p_user_id;

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
$function$;
