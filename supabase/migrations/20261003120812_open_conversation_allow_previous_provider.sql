CREATE OR REPLACE FUNCTION public.open_conversation(p_request_id uuid, p_provider_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_conv uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if not exists (select 1 from service_requests where id = p_request_id and requester_id = v_uid) then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_provider_id = v_uid then
    raise exception 'CANNOT_CHAT_WITH_SELF' using errcode = 'P0001';
  end if;

  if not exists (select 1 from candidates where request_id = p_request_id and provider_id = p_provider_id)
     and not exists (select 1 from conversations where requester_id = v_uid and provider_id = p_provider_id) then
    raise exception 'NOT_A_CANDIDATE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from blocks
    where (blocker_id = v_uid and blocked_id = p_provider_id)
       or (blocker_id = p_provider_id and blocked_id = v_uid)
  ) then
    raise exception 'BLOCKED' using errcode = 'P0001';
  end if;

  select id into v_conv from conversations
   where request_id = p_request_id and provider_id = p_provider_id;

  if v_conv is not null then
    return v_conv;
  end if;

  insert into conversations (request_id, requester_id, provider_id)
  values (p_request_id, v_uid, p_provider_id)
  returning id into v_conv;

  return v_conv;
end;
$$;

REVOKE ALL ON FUNCTION public.open_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_conversation(uuid, uuid) TO authenticated;;
