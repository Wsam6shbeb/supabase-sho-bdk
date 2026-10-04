-- Non-execution report: either party of an ACTIVE order says the service did not happen.
-- No automatic refund (the commission was already charged): the order is cancelled,
-- an open report is filed for admin review, and the other party is notified.
CREATE OR REPLACE FUNCTION public.report_non_execution(p_request_id uuid, p_reason text)
RETURNS public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_req public.service_requests;
  v_ag public.agreements;
  v_other uuid;
  v_report public.reports;
  v_reporter_name text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_req from service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_ag from agreements
   where request_id = p_request_id and state in ('active', 'cancelled')
   order by created_at desc limit 1;
  if not found then
    raise exception 'NO_ACTIVE_AGREEMENT' using errcode = 'P0001';
  end if;

  if v_uid = v_ag.requester_id then
    v_other := v_ag.provider_id;
  elsif v_uid = v_ag.provider_id then
    v_other := v_ag.requester_id;
  else
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- idempotent: this user already reported this request
  select * into v_report from reports
   where request_id = p_request_id and reporter_id = v_uid and reason = 'non_execution'
   limit 1;
  if found then
    return v_report;
  end if;

  if v_req.state <> 'active' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  insert into reports (reporter_id, target_user_id, request_id, reason, details)
  values (v_uid, v_other, p_request_id, 'non_execution', trim(p_reason))
  returning * into v_report;

  update service_requests set state = 'cancelled', cancelled_at = now() where id = p_request_id;
  update agreements set state = 'cancelled', responded_at = coalesce(responded_at, now())
   where id = v_ag.id and state = 'active';
  update conversations set state = 'read_only'
   where request_id = p_request_id and state in ('active', 'negotiating', 'agreement_pending', 'locked_temp');

  select coalesce(nullif(full_name, ''), 'مستخدم') into v_reporter_name from users where id = v_uid;

  perform public._post_system_message(
    v_ag.conversation_id, v_uid,
    'تم تسجيل بلاغ عدم تنفيذ الخدمة. أُغلق الطلب وسيراجع الفريق البلاغ.');

  perform public._notify(
    v_other, 'order_cancelled', 'بلاغ عدم تنفيذ الخدمة',
    v_reporter_name || ' سجّل بلاغ عدم تنفيذ للخدمة. تم إغلاق الطلب وسيراجعه الفريق.',
    jsonb_build_object('conversation_id', v_ag.conversation_id, 'reference_id', p_request_id));

  return v_report;
end;
$$;

REVOKE ALL ON FUNCTION public.report_non_execution(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_non_execution(uuid, text) TO authenticated;
