-- ===============================================================
-- المرحلة 2 من التوثيق: رؤية حالة الطرف الآخر + طلب التوثيق + إشعار القرار
-- لا يغيّر أي جدول. دوال جديدة + تحديث decide_verification (إضافة إشعار فقط).
-- ===============================================================

-- 1) حالة توثيق الطرف الآخر في المحادثة (طرفا المحادثة فقط، بدون أي تفاصيل مراجعة).
--    verified = الحساب معتمد. requested_by_me = أرسلتُ له طلب توثيق سابقاً في هذه المحادثة.
create or replace function public.get_counterparty_verification(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_other uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_conv from public.conversations c
   where c.id = p_conversation_id
     and (c.requester_id = v_uid or c.provider_id = v_uid);
  if not found then
    return null;
  end if;

  v_other := case when v_conv.requester_id = v_uid then v_conv.provider_id else v_conv.requester_id end;

  return jsonb_build_object(
    'verified', coalesce((select u.verification_status = 'approved' from public.users u where u.id = v_other), false),
    'requested_by_me', exists (
      select 1 from public.messages m
       where m.conversation_id = p_conversation_id
         and m.message_type = 'system'
         and m.sender_id = v_uid
         and m.body = 'طُلب من الطرف الآخر توثيق حسابه لزيادة الأمان.'
    )
  );
end;
$$;

revoke all on function public.get_counterparty_verification(uuid) from public, anon;
grant execute on function public.get_counterparty_verification(uuid) to authenticated;

-- 2) طلب توثيق من الطرف الآخر: رسالة نظام في المحادثة + إشعار له (مرة واحدة لكل محادثة).
create or replace function public.request_counterparty_verification(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
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
  if v_conv.state::text in ('locked_temp', 'read_only') then
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

  -- نوع الإشعار new_message موجود في التطبيق؛ نوع جديد كان سيُسقط شاشة الإشعارات الحالية.
  perform public._notify(
    v_other,
    'new_message',
    'طلب توثيق حساب',
    'طلب منك ' || v_name || ' توثيق حسابك. اضغط للبدء.',
    jsonb_build_object('route', '/orders/verify-account', 'reference_id', p_conversation_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.request_counterparty_verification(uuid) from public, anon;
grant execute on function public.request_counterparty_verification(uuid) to authenticated;

-- 3) decide_verification: نفس الدالة الحالية + إشعار للمستخدم بالقرار
--    (النوعان verification_approved / verification_rejected معرّفان أصلاً في التطبيق).
create or replace function public.decide_verification(
  p_id uuid, p_decision text, p_reason text, p_admin uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v public.verifications;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;
  if p_decision = 'rejected' and v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v from public.verifications where id = p_id for update;
  if not found then
    raise exception 'VERIFICATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v.status <> 'pending' then
    raise exception 'ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  update public.verifications
     set status = p_decision::public.verification_status,
         rejection_reason = case when p_decision = 'rejected' then v_reason else null end,
         reviewed_by = p_admin,
         reviewed_at = now()
   where id = p_id;

  update public.users
     set verification_status = p_decision::public.verification_status
   where id = v.user_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_admin, 'admin_decide_verification', 'verification', p_id,
          jsonb_build_object('decision', p_decision, 'user_id', v.user_id, 'reason', v_reason));

  perform public._notify(
    v.user_id,
    case when p_decision = 'approved' then 'verification_approved' else 'verification_rejected' end,
    case when p_decision = 'approved' then 'تم توثيق حسابك' else 'تعذّر توثيق حسابك' end,
    case when p_decision = 'approved'
         then 'أصبح حسابك موثّقاً وتظهر شارة التوثيق للآخرين.'
         else v_reason end,
    jsonb_build_object('route', '/orders/verify-account', 'reference_id', p_id)
  );

  return jsonb_build_object('id', p_id, 'user_id', v.user_id, 'status', p_decision);
end;
$$;

revoke all on function public.decide_verification(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.decide_verification(uuid, text, text, uuid) to service_role;
