-- 1) get_conversation_rating_status: also report whether the other party rated, and whether both did.
create or replace function public.get_conversation_rating_status(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_state text;
  v_score smallint;
  v_other_rated boolean := false;
  v_has_non_execution_report boolean := false;
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

  select sr.state::text into v_state
    from public.service_requests sr
   where sr.id = v_conv.request_id;

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

  return jsonb_build_object(
    'request_id', v_conv.request_id,
    'request_state', v_state,
    'i_rated', v_score is not null,
    'my_score', v_score,
    'other_rated', v_other_rated,
    'both_rated', (v_score is not null and v_other_rated),
    'has_non_execution_report', v_has_non_execution_report
  );
end;
$function$;

-- 2) submit_rating: unchanged logic, plus a closing system message once both parties have rated,
--    so the chat no longer ends on "you can rate each other".
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

  if v_req.state not in ('completion_pending_rating', 'completed')
     and not (v_req.state = 'cancelled' and v_non_execution) then
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

  -- Only completed work increments completed-service counts.
  if v_uid = v_ag.requester_id and v_req.state = 'completion_pending_rating' then
    update public.service_requests set state = 'completed' where id = p_request_id;
    update public.provider_profiles
       set completed_services_count = completed_services_count + 1
     where user_id = v_to;
  end if;

  -- Ratings from a non-execution dispute are recorded but do not affect the provider's average.
  if v_uid = v_ag.requester_id and not v_non_execution then
    update public.provider_profiles
       set rating_avg = coalesce((
             select round(avg(r.score)::numeric, 2)
               from public.ratings r
              where r.to_user_id = v_to
                and exists (
                  select 1 from public.agreements a
                   where a.request_id = r.request_id
                     and a.provider_id = r.to_user_id
                     and a.state = 'active'
                )
           ), 0)
     where user_id = v_to;
  end if;

  -- Both sides rated: close the loop in the chat.
  if (select count(distinct r.from_user_id) from public.ratings r where r.request_id = p_request_id) >= 2 then
    perform public._post_system_message(
      v_ag.conversation_id,
      v_uid,
      case when v_non_execution then 'تم التقييم من الطرفين.' else 'تم تقييم الطرفين. اكتملت الخدمة.' end
    );
  end if;

  return v_rating;
end;
$function$;
