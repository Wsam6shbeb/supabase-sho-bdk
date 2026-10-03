-- ============================================================
-- Agreements on Supabase (phase D)
--
-- SECURITY: create_agreement / approve_agreement / reject_agreement are
-- SECURITY DEFINER and trust caller-supplied user ids, but were executable by
-- anon/authenticated -> anyone could approve on behalf of a provider (debiting
-- their wallet) or create agreements between arbitrary users. They are now
-- service_role only; the app uses the auth.uid()-bound wrappers below.
-- ============================================================

ALTER FUNCTION public.create_agreement(uuid, uuid, uuid, uuid, numeric, text, numeric) SET search_path = public;
ALTER FUNCTION public.approve_agreement(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.reject_agreement(uuid, uuid, text) SET search_path = public;

REVOKE ALL ON FUNCTION public.create_agreement(uuid, uuid, uuid, uuid, numeric, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_agreement(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_agreement(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_agreement(uuid, uuid, uuid, uuid, numeric, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_agreement(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_agreement(uuid, uuid, text) TO service_role;

-- realtime so both parties see agreement changes instantly (RLS still applies)
DO $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agreements') then
    alter publication supabase_realtime add table public.agreements;
  end if;
end $$;

-- helper: post a system message in a conversation (bypasses messages RLS on purpose)
CREATE OR REPLACE FUNCTION public._post_system_message(p_conversation_id uuid, p_sender uuid, p_body text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  insert into public.messages (conversation_id, sender_id, body, message_type)
  values (p_conversation_id, p_sender, p_body, 'system');
$$;
REVOKE ALL ON FUNCTION public._post_system_message(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- requester confirms "we agreed": commission is computed HERE (server-authoritative)
CREATE OR REPLACE FUNCTION public.request_agreement(p_conversation_id uuid, p_price numeric DEFAULT NULL)
RETURNS public.agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_agreement public.agreements;
  v_min numeric;
  v_max numeric;
  v_default numeric;
  v_commission numeric;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_conv from conversations
   where id = p_conversation_id and requester_id = v_uid
   for update;
  if not found then
    raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_conv.state <> 'negotiating' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  if p_price is not null and p_price <= 0 then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from agreements
     where request_id = v_conv.request_id and state in ('pending', 'active')
  ) then
    raise exception 'ALREADY_AGREED' using errcode = 'P0001';
  end if;

  select coalesce((select (value)::text::numeric from app_settings where key = 'commission_min'), 50),
         coalesce((select (value)::text::numeric from app_settings where key = 'commission_max'), 1000),
         coalesce((select (value)::text::numeric from app_settings where key = 'commission_default'), 100)
    into v_min, v_max, v_default;

  if p_price is null then
    v_commission := v_default;
  else
    v_commission := least(v_max, greatest(v_min, round(p_price * 0.05)));
  end if;

  v_agreement := public.create_agreement(
    v_conv.request_id, v_conv.id, v_uid, v_conv.provider_id,
    p_price,
    case when p_price is null then 'default' else 'user_confirmed' end,
    v_commission
  );

  perform public._post_system_message(
    v_conv.id, v_uid,
    'أكّد الزبون أنه اتفق معك لإتمام العمل. قيمة العمولة: ' || v_commission::text ||
    ' ل.س. بالموافقة بينخصم المبلغ فوراً وتبلش الخدمة.'
  );

  return v_agreement;
end;
$$;

-- provider approves / rejects (wallet debit happens inside approve_agreement)
CREATE OR REPLACE FUNCTION public.respond_agreement(
  p_agreement_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL,
  p_share_phone boolean DEFAULT false
)
RETURNS public.agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_before public.agreements;
  v_after public.agreements;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_before from agreements where id = p_agreement_id;
  if not found then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_before.provider_id <> v_uid then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_approve then
    v_after := public.approve_agreement(p_agreement_id, v_uid);
  else
    v_after := public.reject_agreement(p_agreement_id, v_uid, p_reason);
  end if;

  if v_before.state = 'pending' then
    if v_after.state = 'active' then
      if p_share_phone then
        update agreements set phone_shared = true where id = p_agreement_id returning * into v_after;
      end if;
      perform public._post_system_message(
        v_after.conversation_id, v_uid, 'وافق مقدم الخدمة على الاتفاق. بدأت الخدمة.'
      );
    elsif v_after.state = 'rejected' then
      perform public._post_system_message(
        v_after.conversation_id, v_uid, 'رفض مقدم الخدمة الاتفاق. تقدر تكمل التفاوض.'
      );
    elsif v_after.state = 'expired' then
      perform public._post_system_message(
        v_after.conversation_id, v_uid, 'انتهت مهلة الموافقة على الاتفاق.'
      );
    end if;
  end if;

  return v_after;
end;
$$;

-- requester cancels a still-pending agreement
CREATE OR REPLACE FUNCTION public.cancel_agreement(p_agreement_id uuid)
RETURNS public.agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_agreement public.agreements;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_agreement from agreements
   where id = p_agreement_id and requester_id = v_uid
   for update;
  if not found then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_agreement.state <> 'pending' then
    return v_agreement;
  end if;

  update agreements set state = 'cancelled', responded_at = now()
   where id = p_agreement_id
   returning * into v_agreement;

  update service_requests set state = 'negotiating' where id = v_agreement.request_id;
  update conversations
     set state = 'negotiating', locked_reason = null
   where request_id = v_agreement.request_id
     and state in ('locked_temp', 'agreement_pending');

  perform public._post_system_message(
    v_agreement.conversation_id, v_uid, 'ألغى الزبون طلب الاتفاق.'
  );

  return v_agreement;
end;
$$;

-- latest agreement of a conversation (either party). Also expires it lazily when its deadline passed.
CREATE OR REPLACE FUNCTION public.get_conversation_agreement(p_conversation_id uuid)
RETURNS SETOF public.agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_agreement public.agreements;
begin
  if v_uid is null then
    return;
  end if;

  select * into v_agreement from agreements a
   where a.conversation_id = p_conversation_id
     and (a.requester_id = v_uid or a.provider_id = v_uid)
   order by a.created_at desc
   limit 1;
  if not found then
    return;
  end if;

  if v_agreement.state = 'pending' and v_agreement.expires_at < now() then
    update agreements set state = 'expired', responded_at = now()
     where id = v_agreement.id and state = 'pending'
     returning * into v_agreement;

    update service_requests set state = 'negotiating' where id = v_agreement.request_id;
    update conversations
       set state = 'negotiating', locked_reason = null
     where request_id = v_agreement.request_id
       and state in ('locked_temp', 'agreement_pending');

    perform public._post_system_message(
      v_agreement.conversation_id, v_agreement.requester_id, 'انتهت مهلة الموافقة على الاتفاق.'
    );
  end if;

  return next v_agreement;
end;
$$;

REVOKE ALL ON FUNCTION public.request_agreement(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_agreement(uuid, boolean, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_agreement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_conversation_agreement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_agreement(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_agreement(uuid, boolean, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_agreement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_agreement(uuid) TO authenticated;
