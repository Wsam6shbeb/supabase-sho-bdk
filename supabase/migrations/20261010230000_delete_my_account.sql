-- In-app account deletion (required by Google Play / App Store).
-- Personal data is deleted or anonymized and the user can no longer sign in. Records other users or the
-- platform depend on (agreements, messages, ratings, ledger/wallet, reports) are kept but disassociated from
-- any personal data; this retention must be disclosed in the privacy policy.

alter table public.users add column if not exists deleted_at timestamptz;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
  delete from public.verifications where user_id = v_uid;
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
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
