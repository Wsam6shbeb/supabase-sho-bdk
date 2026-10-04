-- Lets either party's conversation screen know whether the order is finished
-- and whether the caller already rated (used by the provider's rating card).
CREATE OR REPLACE FUNCTION public.get_conversation_rating_status(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_state text;
  v_score smallint;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_conv from conversations
   where id = p_conversation_id and (requester_id = v_uid or provider_id = v_uid);
  if not found then
    return null;
  end if;

  select sr.state::text into v_state from service_requests sr where sr.id = v_conv.request_id;
  select r.score into v_score from ratings r
   where r.request_id = v_conv.request_id and r.from_user_id = v_uid;

  return jsonb_build_object(
    'request_id', v_conv.request_id,
    'request_state', v_state,
    'i_rated', v_score is not null,
    'my_score', v_score
  );
end;
$$;

REVOKE ALL ON FUNCTION public.get_conversation_rating_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversation_rating_status(uuid) TO authenticated;
