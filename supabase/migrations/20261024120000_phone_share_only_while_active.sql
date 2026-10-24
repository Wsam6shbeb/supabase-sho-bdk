-- ===============================================================
-- مشاركة الرقم متاحة فقط ما دامت المحادثة فعّالة.
-- بعد إنهاء الخدمة تصبح المحادثة read_only بينما يبقى الاتفاق active،
-- فكان زر "شارك رقمي" يظهر ويعمل بعد انتهاء كل شيء.
-- التغيير: التعريفان أدناه نسخة حرفية من الدالتين الحاليتين + الإضافات المعلَّمة بـ [جديد].
-- لا تغيير في الجداول ولا الصلاحيات (CREATE OR REPLACE بنفس التوقيع).
-- ===============================================================

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
  v_conv_state text; -- [جديد]
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

  -- [جديد] حالة المحادثة: تصبح read_only عند انتهاء الخدمة
  select c.state::text into v_conv_state from public.conversations c where c.id = p_conversation_id;

  -- The other party's number is revealed only once the agreement is active.
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
    -- [جديد] هل يُعرض زر "شارك رقمي" الآن؟ (اتفاق فعّال + محادثة فعّالة + لم أشارك بعد)
    'conversation_state', v_conv_state,
    'can_share', (v_ag.state = 'active' and v_conv_state = 'active' and not v_i_shared)
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
  v_conv_state text; -- [جديد]
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

  -- [جديد] بعد اعتماد الاتفاق لا تُقبل المشاركة إلا والمحادثة فعّالة (ليس بعد إنهاء الخدمة)
  select c.state::text into v_conv_state from public.conversations c where c.id = p_conversation_id;
  if v_ag.state = 'active' and coalesce(v_conv_state, '') <> 'active' then
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

  -- Tell the other side only when the number is actually visible to them (agreement active).
  if v_inserted > 0 and v_ag.state = 'active' then
    perform public._post_system_message(
      p_conversation_id, v_uid,
      'شارك ' || coalesce(v_name, 'الطرف الآخر') || ' رقم هاتفه معك.'
    );
  end if;
end;
$function$;
