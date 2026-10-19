-- Keep verification decision and the user's profile status in one transaction.
-- This migration is branch-only until reviewed and applied deliberately.
create or replace function public.review_verification_request(
  p_verification_id uuid,
  p_status public.verification_status,
  p_rejection_reason text,
  p_reviewed_by uuid
)
returns table (id uuid, user_id uuid, status public.verification_status)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_updated_id uuid;
begin
  if p_status not in ('approved'::public.verification_status, 'rejected'::public.verification_status) then
    raise exception 'Invalid verification decision' using errcode = '22023';
  end if;

  if p_status = 'rejected'::public.verification_status and nullif(btrim(p_rejection_reason), '') is null then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;

  update public.verifications v
  set status = p_status,
      rejection_reason = case when p_status = 'rejected'::public.verification_status then left(btrim(p_rejection_reason), 500) else null end,
      reviewed_by = case when exists (select 1 from public.users u where u.id = p_reviewed_by) then p_reviewed_by else null end,
      reviewed_at = now()
  where v.id = p_verification_id
    and v.status = 'pending'::public.verification_status
  returning v.user_id, v.id into v_user_id, v_updated_id;

  if v_updated_id is null then
    raise exception 'Verification request not found or already reviewed' using errcode = 'P0002';
  end if;

  update public.users u
  set verification_status = p_status,
      updated_at = now()
  where u.id = v_user_id;

  if not found then
    raise exception 'Verification user profile not found' using errcode = 'P0002';
  end if;

  return query select v_updated_id, v_user_id, p_status;
end;
$$;

revoke all on function public.review_verification_request(uuid, public.verification_status, text, uuid) from public;
revoke all on function public.review_verification_request(uuid, public.verification_status, text, uuid) from anon;
revoke all on function public.review_verification_request(uuid, public.verification_status, text, uuid) from authenticated;
grant execute on function public.review_verification_request(uuid, public.verification_status, text, uuid) to service_role;
