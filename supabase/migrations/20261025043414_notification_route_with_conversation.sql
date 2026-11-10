-- إشعار الرسالة الجديدة لطالب الخدمة: إضافة معرّف المحادثة للمسار (بين الحسابين نفسيهما قد توجد عدة محادثات)

CREATE OR REPLACE FUNCTION public.notify_on_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_conv public.conversations;
  v_recipient uuid;
  v_sender_name text;
  v_route text;
  v_existing uuid;
  v_count integer;
begin
  if new.message_type <> 'text' then
    return new;
  end if;

  select * into v_conv from conversations where id = new.conversation_id;
  if not found then return new; end if;

  v_recipient := case when new.sender_id = v_conv.requester_id then v_conv.provider_id else v_conv.requester_id end;
  select coalesce(nullif(full_name, ''), 'مستخدم') into v_sender_name from users where id = new.sender_id;

  v_route := case
    when v_recipient = v_conv.provider_id
      then '/orders/conversation?conversation_id=' || v_conv.id::text || '&name=' || coalesce(v_sender_name, '')
    -- [تعديل] نضيف معرّف المحادثة: بين الحسابين نفسيهما قد توجد عدة محادثات، ومعرّف مقدم الخدمة وحده لا يحدد أيّها
    else '/orders/chat?provider_id=' || v_conv.provider_id::text || '&conversation_id=' || v_conv.id::text
  end;

  select id, coalesce((payload->>'count')::int, 1) into v_existing, v_count
    from notifications
   where user_id = v_recipient
     and type = 'new_message'
     and read_at is null
     and expires_at > now()
     and payload->>'conversation_id' = v_conv.id::text
   order by created_at desc limit 1;

  if v_existing is not null then
    update notifications
       set payload = payload || jsonb_build_object(
             'count', v_count + 1,
             'body', left(new.body, 80),
             'title', case when v_count + 1 > 1
                           then 'رسائل جديدة من ' || v_sender_name || ' (' || (v_count + 1)::text || ')'
                           else 'رسالة جديدة من ' || v_sender_name end),
           created_at = now()
     where id = v_existing;
  else
    perform public._notify(
      v_recipient, 'new_message', 'رسالة جديدة من ' || v_sender_name, left(new.body, 80),
      jsonb_build_object('conversation_id', v_conv.id, 'reference_id', v_conv.id, 'route', v_route, 'count', 1));
  end if;

  return new;
end;
$function$;

-- الإشعارات غير المقروءة الحالية (ما زالت تحمل المسار القديم) نصلحها بنفس الإضافة
UPDATE public.notifications
   SET payload = jsonb_set(payload, '{route}', to_jsonb((payload->>'route') || '&conversation_id=' || (payload->>'conversation_id')))
 WHERE type = 'new_message'
   AND read_at IS NULL
   AND expires_at > now()
   AND payload ? 'conversation_id'
   AND payload->>'route' LIKE '/orders/chat?provider_id=%'
   AND payload->>'route' NOT LIKE '%conversation_id=%';
;
