-- ============================================================
-- Phase G: server-generated notifications (persisted + realtime).
-- Events caused by the OTHER party (new message, agreement request/decision,
-- order completed, rating received) are written by triggers, so they exist
-- even when the recipient's app was closed.
-- Clients can only mark them read / hide them; they can no longer insert.
-- ============================================================

REVOKE INSERT, UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read_at, expires_at) ON public.notifications TO authenticated;

DO $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public._notify(
  p_user uuid, p_type text, p_title text, p_body text, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  insert into public.notifications (user_id, type, payload)
  values (p_user, p_type, coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('title', p_title, 'body', p_body))
  returning id;
$$;
REVOKE ALL ON FUNCTION public._notify(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------- new message: one rolling notification per conversation ----------
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    else '/orders/chat?provider_id=' || v_conv.provider_id::text
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
$$;

DROP TRIGGER IF EXISTS messages_notify_trg ON public.messages;
CREATE TRIGGER messages_notify_trg
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();

-- ---------- agreements: request + decisions ----------
CREATE OR REPLACE FUNCTION public.notify_on_agreement_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_requester_name text;
  v_provider_name text;
  v_conv_route text;
begin
  select coalesce(nullif(full_name, ''), 'الزبون') into v_requester_name from users where id = new.requester_id;
  select coalesce(nullif(full_name, ''), 'مقدم الخدمة') into v_provider_name from users where id = new.provider_id;

  if tg_op = 'INSERT' then
    if new.state = 'pending' then
      perform public._notify(
        new.provider_id, 'agreement_confirmed', 'طلب اتفاق جديد',
        v_requester_name || ' أكّد الاتفاق معك. وافق أو ارفض قبل انتهاء المهلة.',
        jsonb_build_object('conversation_id', new.conversation_id, 'reference_id', new.id,
          'route', '/orders/conversation?conversation_id=' || new.conversation_id::text || '&name=' || v_requester_name));
    end if;
    return new;
  end if;

  if old.state = 'pending' and new.state <> 'pending' then
    if new.state = 'active' then
      perform public._notify(
        new.requester_id, 'agreement_approved', 'تم قبول الاتفاق!',
        v_provider_name || ' وافق على الاتفاق. الطلب صار نشطاً.',
        jsonb_build_object('conversation_id', new.conversation_id, 'reference_id', new.id,
          'route', '/orders/chat?provider_id=' || new.provider_id::text));
    elsif new.state = 'rejected' then
      perform public._notify(
        new.requester_id, 'agreement_rejected', 'تم رفض الاتفاق',
        v_provider_name || ' رفض الاتفاق. تقدر تكمل التفاوض مع مرشح آخر.',
        jsonb_build_object('conversation_id', new.conversation_id, 'reference_id', new.id,
          'route', '/orders/chat?provider_id=' || new.provider_id::text));
    elsif new.state = 'cancelled' then
      perform public._notify(
        new.provider_id, 'agreement_rejected', 'ألغى الزبون طلب الاتفاق',
        v_requester_name || ' ألغى طلب الاتفاق.',
        jsonb_build_object('conversation_id', new.conversation_id, 'reference_id', new.id,
          'route', '/orders/conversation?conversation_id=' || new.conversation_id::text || '&name=' || v_requester_name));
    elsif new.state = 'expired' then
      perform public._notify(
        new.requester_id, 'agreement_rejected', 'انتهت مهلة الموافقة',
        'تم إلغاء الاتفاق تلقائياً لأن ' || v_provider_name || ' لم يرد.',
        jsonb_build_object('conversation_id', new.conversation_id, 'reference_id', new.id,
          'route', '/orders/chat?provider_id=' || new.provider_id::text));
      perform public._notify(
        new.provider_id, 'agreement_rejected', 'انتهت مهلة الموافقة',
        'انتهت مهلة طلب الاتفاق من ' || v_requester_name || '.',
        jsonb_build_object('conversation_id', new.conversation_id, 'reference_id', new.id,
          'route', '/orders/conversation?conversation_id=' || new.conversation_id::text || '&name=' || v_requester_name));
    end if;
  end if;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS agreements_notify_trg ON public.agreements;
CREATE TRIGGER agreements_notify_trg
  AFTER INSERT OR UPDATE OF state ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_agreement_change();

-- ---------- order completed: tell the provider ----------
CREATE OR REPLACE FUNCTION public.notify_on_request_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_ag public.agreements;
  v_name text;
begin
  if new.state = 'completion_pending_rating' and old.state is distinct from new.state then
    select * into v_ag from agreements
     where request_id = new.id and state = 'active' order by created_at desc limit 1;
    if found then
      select coalesce(nullif(full_name, ''), 'الزبون') into v_name from users where id = v_ag.requester_id;
      perform public._notify(
        v_ag.provider_id, 'order_completed', 'تم إنهاء الخدمة',
        v_name || ' أنهى الخدمة. بتقدر تقيّمه.',
        jsonb_build_object('conversation_id', v_ag.conversation_id, 'reference_id', new.id,
          'route', '/orders/conversation?conversation_id=' || v_ag.conversation_id::text || '&name=' || v_name));
    end if;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS service_requests_notify_trg ON public.service_requests;
CREATE TRIGGER service_requests_notify_trg
  AFTER UPDATE OF state ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_request_completed();

-- ---------- rating received ----------
CREATE OR REPLACE FUNCTION public.notify_on_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  perform public._notify(
    new.to_user_id, 'rating_received', 'حصلت على تقييم جديد',
    'قيّمك ' || (select coalesce(nullif(full_name, ''), 'مستخدم') from users where id = new.from_user_id)
      || ' بـ ' || new.score::text || ' من 5 نجوم.',
    jsonb_build_object('reference_id', new.request_id));
  return new;
end;
$$;

DROP TRIGGER IF EXISTS ratings_notify_trg ON public.ratings;
CREATE TRIGGER ratings_notify_trg
  AFTER INSERT ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_rating();
