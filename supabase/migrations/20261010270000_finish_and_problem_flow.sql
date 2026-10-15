-- Finish / report flow after the agreement is approved (commission already deducted):
--  * provider can mark "finished" (customer is notified; auto-completes after a grace period)
--  * either party can report a problem (never cancels the order; the reporter may rate right away)
--  * ratings are allowed earlier: provider after finishing, and anyone after reporting
--  * the old instant-cancel "non execution" function is closed for clients

alter table public.service_requests add column if not exists provider_finished_at timestamptz;

insert into public.app_settings (key, value) values
  ('auto_complete_after_provider_finish_hours', '48'::jsonb),
  ('auto_complete_no_action_hours', '48'::jsonb),
  ('problem_report_window_hours', '48'::jsonb)
on conflict (key) do nothing;

-- 1) Provider marks the service as finished.
create or replace function public.provider_finish_service(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.service_requests;
  v_ag public.agreements;
  v_hours integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_ag from public.agreements a
   where a.request_id = p_request_id and a.state = 'active' and a.provider_id = v_uid
   order by a.created_at desc limit 1;
  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_req.provider_finished_at is not null then
    return; -- idempotent
  end if;
  if v_req.state <> 'active' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.service_requests set provider_finished_at = now() where id = p_request_id;

  v_hours := coalesce((select (value)::text::integer from public.app_settings
                        where key = 'auto_complete_after_provider_finish_hours'), 48);

  perform public._post_system_message(
    v_ag.conversation_id, v_uid,
    'أنهى مقدم الخدمة الخدمة. بانتظار تأكيدك، وإن لم تردّ يُعتمد الطلب تلقائياً بعد ' || v_hours::text || ' ساعة.');

  perform public._notify(
    v_ag.requester_id, 'provider_finished', 'مقدم الخدمة أنهى الخدمة',
    'أكّد تنفيذ الخدمة وقيّم مقدم الخدمة. إن لم تردّ يُعتمد الطلب تلقائياً بعد ' || v_hours::text || ' ساعة.',
    jsonb_build_object(
      'conversation_id', v_ag.conversation_id,
      'reference_id', p_request_id,
      'route', '/orders/chat?provider_id=' || v_ag.provider_id::text));
end;
$$;

-- 2) Either party reports a problem. Does NOT cancel or change the order; only records the case for the admin.
create or replace function public.report_problem(p_request_id uuid, p_details text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.service_requests;
  v_ag public.agreements;
  v_target uuid;
  v_window integer;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if length(btrim(coalesce(p_details, ''))) < 3 then
    raise exception 'DETAILS_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_req from public.service_requests where id = p_request_id;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_ag from public.agreements a
   where a.request_id = p_request_id and a.state = 'active'
     and (a.requester_id = v_uid or a.provider_id = v_uid)
   order by a.created_at desc limit 1;
  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_req.state not in ('active', 'completion_pending_rating', 'completed') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  v_window := coalesce((select (value)::text::integer from public.app_settings
                         where key = 'problem_report_window_hours'), 48);
  if v_req.state <> 'active' and v_req.completed_at is not null
     and v_req.completed_at < now() - make_interval(hours => v_window) then
    raise exception 'REPORT_WINDOW_CLOSED' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.reports r where r.request_id = p_request_id and r.reporter_id = v_uid) then
    raise exception 'ALREADY_REPORTED' using errcode = 'P0001';
  end if;

  v_target := case when v_ag.requester_id = v_uid then v_ag.provider_id else v_ag.requester_id end;

  insert into public.reports (reporter_id, target_user_id, request_id, reason, details)
  values (v_uid, v_target, p_request_id, 'problem', btrim(p_details))
  returning id into v_id;

  return v_id;
end;
$$;

-- 3) Ratings: allowed after completion (both), after the provider finished (provider),
--    and right after reporting (the reporter). Averages are maintained by the ratings trigger.
create or replace function public.submit_rating(p_request_id uuid, p_score integer, p_comment text default null::text, p_tags text[] default null::text[])
returns ratings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_req public.service_requests;
  v_ag public.agreements;
  v_to uuid;
  v_rating public.ratings;
  v_non_execution boolean;
  v_allowed boolean := false;
  v_state_now text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception 'INVALID_SCORE' using errcode = 'P0001';
  end if;

  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.reports
    where request_id = p_request_id and reason = 'non_execution'
  ) into v_non_execution;

  select * into v_ag
    from public.agreements
   where request_id = p_request_id
     and (
       state = 'active'
       or (state = 'cancelled' and v_non_execution)
     )
   order by created_at desc
   limit 1;

  if not found then
    raise exception 'NO_ACTIVE_AGREEMENT' using errcode = 'P0001';
  end if;

  if v_uid = v_ag.requester_id then
    v_to := v_ag.provider_id;
  elsif v_uid = v_ag.provider_id then
    v_to := v_ag.requester_id;
  else
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_req.state in ('completion_pending_rating', 'completed') then
    v_allowed := true;
  elsif v_req.state = 'cancelled' and v_non_execution then
    v_allowed := true;
  elsif v_req.state = 'active' then
    if v_uid = v_ag.provider_id and v_req.provider_finished_at is not null then
      v_allowed := true;
    elsif exists (select 1 from public.reports r where r.request_id = p_request_id and r.reporter_id = v_uid) then
      v_allowed := true;
    end if;
  end if;
  if not v_allowed then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.ratings
    where request_id = p_request_id and from_user_id = v_uid
  ) then
    raise exception 'ALREADY_RATED' using errcode = 'P0001';
  end if;

  insert into public.ratings (request_id, from_user_id, to_user_id, score, comment, tags)
  values (p_request_id, v_uid, v_to, p_score, nullif(trim(p_comment), ''), p_tags)
  returning * into v_rating;

  -- The customer's rating closes the request (only completed work increments the provider's count).
  if v_uid = v_ag.requester_id and v_req.state = 'completion_pending_rating' then
    update public.service_requests set state = 'completed' where id = p_request_id;
    update public.provider_profiles
       set completed_services_count = completed_services_count + 1
     where user_id = v_to;
  end if;

  -- Both rated and the order is completed: close the loop in the chat.
  select sr.state::text into v_state_now from public.service_requests sr where sr.id = p_request_id;
  if v_state_now = 'completed'
     and (select count(distinct r.from_user_id) from public.ratings r where r.request_id = p_request_id) >= 2 then
    perform public._post_system_message(
      v_ag.conversation_id, v_uid,
      case when v_non_execution then 'تم التقييم من الطرفين.' else 'تم تقييم الطرفين. اكتملت الخدمة.' end
    );
  end if;

  return v_rating;
end;
$function$;

-- 4) Auto-completion (hourly cron already calls this): in addition to overdue ratings, complete requests that
--    nobody confirmed (provider finished long ago, or nobody acted since approval).
create or replace function public.finalize_overdue_requests()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hours integer;
  v_finish_hours integer;
  v_noaction_hours integer;
  v_days integer;
  v_n integer := 0;
  r record;
begin
  v_hours := coalesce(
    (select (value)::text::integer from app_settings where key = 'rating_window_hours'), 48);
  v_finish_hours := coalesce(
    (select (value)::text::integer from app_settings where key = 'auto_complete_after_provider_finish_hours'), 48);
  v_noaction_hours := coalesce(
    (select (value)::text::integer from app_settings where key = 'auto_complete_no_action_hours'), 48);
  v_days := coalesce(
    (select (value)::text::integer from app_settings where key = 'chat_writable_after_completion_days'), 7);

  -- (existing) customer pressed "done" but never rated
  for r in
    select sr.id, a.provider_id, a.requester_id, a.conversation_id
      from service_requests sr
      join agreements a on a.request_id = sr.id and a.state = 'active'
     where sr.state = 'completion_pending_rating'
       and sr.completed_at < now() - make_interval(hours => v_hours)
     for update of sr skip locked
  loop
    update service_requests set state = 'completed'
     where id = r.id and state = 'completion_pending_rating';
    if found then
      update provider_profiles
         set completed_services_count = completed_services_count + 1
       where user_id = r.provider_id;
      perform public._post_system_message(
        r.conversation_id, r.requester_id, 'تم اعتماد الطلب تلقائياً لانتهاء مهلة التقييم.');
      v_n := v_n + 1;
    end if;
  end loop;

  -- (new) still "active": provider finished and the customer never answered, or nobody acted at all
  for r in
    select sr.id, a.provider_id, a.requester_id, a.conversation_id
      from service_requests sr
      join agreements a on a.request_id = sr.id and a.state = 'active'
     where sr.state = 'active'
       and (
         (sr.provider_finished_at is not null
            and sr.provider_finished_at < now() - make_interval(hours => v_finish_hours))
         or (sr.provider_finished_at is null and a.responded_at is not null
            and a.responded_at < now() - make_interval(hours => v_noaction_hours))
       )
     for update of sr skip locked
  loop
    update service_requests set state = 'completed', completed_at = now()
     where id = r.id and state = 'active';
    if found then
      update provider_profiles
         set completed_services_count = completed_services_count + 1
       where user_id = r.provider_id;
      update conversations set writable_until = now() + make_interval(days => v_days)
       where id = r.conversation_id;
      perform public._post_system_message(
        r.conversation_id, r.requester_id, 'تم اعتماد الطلب تلقائياً بعد انتهاء المهلة. بتقدروا تقيّموا بعض.');
      v_n := v_n + 1;
    end if;
  end loop;

  update conversations set state = 'read_only'
   where state = 'active' and writable_until is not null and writable_until < now();

  return v_n;
end;
$function$;

-- 5) Close the instant-cancel "non execution" function for clients (kept for history; replaced by report_problem).
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'report_non_execution'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end;
$$;

revoke all on function public.provider_finish_service(uuid) from public, anon;
revoke all on function public.report_problem(uuid, text) from public, anon;
grant execute on function public.provider_finish_service(uuid) to authenticated;
grant execute on function public.report_problem(uuid, text) to authenticated;
