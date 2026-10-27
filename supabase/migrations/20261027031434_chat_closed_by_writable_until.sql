-- المحادثة المنتهية خدمتها تُغلق للكتابة لحظة انتهاء مهلة writable_until (القيمة 0 = فوراً)،
-- لكن حالتها تتحول إلى read_only بمهمة مجدولة كل ساعة. نجعل مشاركة الرقم وطلب التوثيق يعتمدان على المهلة أيضاً.

CREATE OR REPLACE FUNCTION public.get_phone_share_status(p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_ag public.agreements;
  v_other uuid;
  v_i_shared boolean;
  v_other_shared boolean;
  v_phone text;
  v_name text;
  v_conv_state text;
  v_conv_open boolean;
begin
  if v_uid is null then
    return jsonb_build_object('available', false);
  end if;

  select * into v_ag
    from public.agreements a
   where a.conversation_id = p_conversation_id
     and a.state in ('pending', 'active')
     and (a.requester_id = v_uid or a.provider_id = v_uid)
   order by a.created_at desc
   limit 1;
  if not found then
    return jsonb_build_object('available', false);
  end if;

  v_other := case when v_ag.requester_id = v_uid then v_ag.provider_id else v_ag.requester_id end;

  select exists (select 1 from public.phone_shares s where s.agreement_id = v_ag.id and s.from_user_id = v_uid) into v_i_shared;
  select exists (select 1 from public.phone_shares s where s.agreement_id = v_ag.id and s.from_user_id = v_other) into v_other_shared;

  select c.state::text, (c.writable_until is null or c.writable_until > now())
    into v_conv_state, v_conv_open
    from public.conversations c where c.id = p_conversation_id;

  if v_other_shared and v_ag.state = 'active' then
    select u.phone, nullif(u.full_name, '') into v_phone, v_name from public.users u where u.id = v_other;
  end if;

  return jsonb_build_object(
    'available', true,
    'agreement_state', v_ag.state::text,
    'i_shared', v_i_shared,
    'other_shared', (v_other_shared and v_ag.state = 'active'),
    'other_phone', v_phone,
    'other_name', v_name,
    'i_have_phone', exists (select 1 from public.users u where u.id = v_uid and coalesce(u.phone, '') <> ''),
    'conversation_state', v_conv_state,
    'can_share', (v_ag.state = 'active' and v_conv_state = 'active' and coalesce(v_conv_open, false) and not v_i_shared)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.share_my_phone(p_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_ag public.agreements;
  v_phone text;
  v_name text;
  v_inserted int;
  v_conv_state text;
  v_conv_open boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_ag
    from public.agreements a
   where a.conversation_id = p_conversation_id
     and a.state in ('pending', 'active')
     and (a.requester_id = v_uid or a.provider_id = v_uid)
   order by a.created_at desc
   limit 1;
  if not found then
    raise exception 'NO_ACTIVE_AGREEMENT' using errcode = 'P0001';
  end if;

  select c.state::text, (c.writable_until is null or c.writable_until > now())
    into v_conv_state, v_conv_open
    from public.conversations c where c.id = p_conversation_id;
  if v_ag.state = 'active' and (coalesce(v_conv_state, '') <> 'active' or not coalesce(v_conv_open, false)) then
    raise exception 'CONVERSATION_CLOSED' using errcode = 'P0001';
  end if;

  select u.phone, nullif(u.full_name, '') into v_phone, v_name from public.users u where u.id = v_uid;
  if coalesce(v_phone, '') = '' then
    raise exception 'PHONE_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.phone_shares (agreement_id, from_user_id)
  values (v_ag.id, v_uid)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 and v_ag.state = 'active' then
    perform public._post_system_message(
      p_conversation_id, v_uid,
      'شارك ' || coalesce(v_name, 'الطرف الآخر') || ' رقم هاتفه معك.'
    );
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_counterparty_verification(p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_other uuid;
  v_name text;
  v_body constant text := 'طُلب من الطرف الآخر توثيق حسابه لزيادة الأمان.';
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if not public.current_user_is_active() then
    raise exception 'ACCOUNT_SUSPENDED' using errcode = 'P0001';
  end if;

  select * into v_conv from public.conversations c
   where c.id = p_conversation_id
     and (c.requester_id = v_uid or c.provider_id = v_uid);
  if not found then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_conv.state::text in ('locked_temp', 'read_only')
     or (v_conv.writable_until is not null and v_conv.writable_until <= now()) then
    raise exception 'CONVERSATION_CLOSED' using errcode = 'P0001';
  end if;

  v_other := case when v_conv.requester_id = v_uid then v_conv.provider_id else v_conv.requester_id end;

  if public.is_blocked_between(v_uid, v_other) then
    raise exception 'BLOCKED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.users u where u.id = v_other and u.verification_status = 'approved') then
    raise exception 'ALREADY_VERIFIED' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.messages m
     where m.conversation_id = p_conversation_id
       and m.message_type = 'system'
       and m.sender_id = v_uid
       and m.body = v_body
  ) then
    raise exception 'ALREADY_REQUESTED' using errcode = 'P0001';
  end if;

  select coalesce(nullif(u.full_name, ''), 'مستخدم') into v_name from public.users u where u.id = v_uid;

  perform public._post_system_message(p_conversation_id, v_uid, v_body);

  perform public._notify(
    v_other,
    'new_message',
    'طلب توثيق حساب',
    'طلب منك ' || v_name || ' توثيق حسابك. اضغط للبدء.',
    jsonb_build_object('route', '/orders/verify-account', 'reference_id', p_conversation_id)
  );

  return jsonb_build_object('ok', true);
end;
$function$;
