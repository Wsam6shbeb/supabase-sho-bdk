-- Keep the agreement-request system message accurate for both people in the shared conversation.
-- The previous wording addressed only the provider, so the customer saw a misleading approval instruction.
CREATE OR REPLACE FUNCTION public.request_agreement(
  p_conversation_id uuid,
  p_price numeric DEFAULT NULL::numeric
)
RETURNS public.agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    'أرسل الزبون طلب تأكيد الاتفاق. قيمة الخدمة: ' ||
    coalesce(v_agreement.price::text || ' ل.س', 'غير محددة') ||
    '. بانتظار موافقة مقدم الخدمة.'
  );

  return v_agreement;
end;
$function$;
