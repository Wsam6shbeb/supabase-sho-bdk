-- get_conversation_rating_status: besides the rating info, tell the UI what the current user can do now
-- (rate / finish / report), so screens don't re-implement the server rules.
create or replace function public.get_conversation_rating_status(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_req public.service_requests;
  v_ag public.agreements;
  v_has_ag boolean;
  v_score smallint;
  v_other_rated boolean := false;
  v_has_non_execution_report boolean := false;
  v_is_provider boolean := false;
  v_reported boolean := false;
  v_window integer;
  v_can_rate boolean := false;
  v_can_report boolean := false;
  v_can_finish boolean := false;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_conv
    from public.conversations
   where id = p_conversation_id
     and (requester_id = v_uid or provider_id = v_uid);
  if not found then
    return null;
  end if;

  select * into v_req from public.service_requests sr where sr.id = v_conv.request_id;

  select r.score into v_score
    from public.ratings r
   where r.request_id = v_conv.request_id
     and r.from_user_id = v_uid;

  select exists (
    select 1 from public.ratings r
     where r.request_id = v_conv.request_id
       and r.from_user_id <> v_uid
  ) into v_other_rated;

  select exists (
    select 1 from public.reports rep
     where rep.request_id = v_conv.request_id
       and rep.reason = 'non_execution'
  ) into v_has_non_execution_report;

  select * into v_ag from public.agreements a
   where a.request_id = v_conv.request_id and a.state = 'active'
     and (a.requester_id = v_uid or a.provider_id = v_uid)
   order by a.created_at desc limit 1;
  v_has_ag := found;
  v_is_provider := v_has_ag and v_ag.provider_id = v_uid;

  select exists (select 1 from public.reports r where r.request_id = v_conv.request_id and r.reporter_id = v_uid)
    into v_reported;

  v_window := coalesce((select (value)::text::integer from public.app_settings
                         where key = 'problem_report_window_hours'), 48);

  if v_has_ag and v_score is null then
    if v_req.state in ('completion_pending_rating', 'completed') then
      v_can_rate := true;
    elsif v_req.state = 'active' then
      if (v_is_provider and v_req.provider_finished_at is not null) or v_reported then
        v_can_rate := true;
      end if;
    end if;
  end if;

  if v_has_ag and not v_reported and v_req.state in ('active', 'completion_pending_rating', 'completed')
     and (v_req.state = 'active' or v_req.completed_at is null
          or v_req.completed_at >= now() - make_interval(hours => v_window)) then
    v_can_report := true;
  end if;

  if v_is_provider and v_req.state = 'active' and v_req.provider_finished_at is null then
    v_can_finish := true;
  end if;

  return jsonb_build_object(
    'request_id', v_conv.request_id,
    'request_state', v_req.state::text,
    'i_rated', v_score is not null,
    'my_score', v_score,
    'other_rated', v_other_rated,
    'both_rated', (v_score is not null and v_other_rated),
    'has_non_execution_report', v_has_non_execution_report,
    'is_provider', v_is_provider,
    'provider_finished', v_req.provider_finished_at is not null,
    'i_reported', v_reported,
    'can_rate', v_can_rate,
    'can_report', v_can_report,
    'can_finish', v_can_finish
  );
end;
$function$;
