-- Can the caller write in this conversation, and if not, why?
-- Privacy: the blocker learns "blocked_by_me" (so the app can offer to unblock), while the blocked
-- user only sees a neutral "unavailable" and never learns that they were blocked.
CREATE OR REPLACE FUNCTION public.get_conversation_write_status(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_other uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_conv from conversations
   where id = p_conversation_id and (requester_id = v_uid or provider_id = v_uid);
  if not found then
    return null;
  end if;

  v_other := case when v_conv.requester_id = v_uid then v_conv.provider_id else v_conv.requester_id end;

  if exists (select 1 from blocks where blocker_id = v_uid and blocked_id = v_other) then
    return jsonb_build_object('writable', false, 'reason', 'blocked_by_me', 'other_user_id', v_other);
  end if;

  if exists (select 1 from blocks where blocker_id = v_other and blocked_id = v_uid) then
    return jsonb_build_object('writable', false, 'reason', 'unavailable', 'other_user_id', v_other);
  end if;

  if v_conv.state not in ('negotiating', 'agreement_pending', 'active')
     or (v_conv.writable_until is not null and v_conv.writable_until <= now()) then
    return jsonb_build_object('writable', false, 'reason', 'closed', 'other_user_id', v_other);
  end if;

  return jsonb_build_object('writable', true, 'reason', null, 'other_user_id', v_other);
end;
$$;

REVOKE ALL ON FUNCTION public.get_conversation_write_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversation_write_status(uuid) TO authenticated;
