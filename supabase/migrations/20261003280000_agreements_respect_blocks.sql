-- Agreements and blocks: a blocked relationship can neither start nor approve an agreement.
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

  -- no agreements with someone you blocked / who blocked you
  if public.is_blocked_between(v_conv.requester_id, v_conv.provider_id) then
    raise exception 'BLOCKED' using errcode = 'P0001';
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

  -- a blocked relationship cannot be approved (neutral error: the provider is not told about the block)
  if p_approve and v_before.state = 'pending'
     and public.is_blocked_between(v_before.requester_id, v_before.provider_id) then
    raise exception 'AGREEMENT_UNAVAILABLE' using errcode = 'P0001';
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

REVOKE ALL ON FUNCTION public.request_agreement(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_agreement(uuid, boolean, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_agreement(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_agreement(uuid, boolean, text, boolean) TO authenticated;
