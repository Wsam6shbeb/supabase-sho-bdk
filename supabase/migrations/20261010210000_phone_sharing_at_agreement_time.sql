-- Phone sharing is decided at agreement time (checkbox): a party may record the intent while the agreement is
-- pending or active; the OTHER party only ever sees the number once the agreement is active.

create or replace function public.share_my_phone(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_ag public.agreements;
  v_phone text;
  v_name text;
  v_inserted int;
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
$$;

create or replace function public.get_phone_share_status(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_ag public.agreements;
  v_other uuid;
  v_i_shared boolean;
  v_other_shared boolean;
  v_phone text;
  v_name text;
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
    'i_have_phone', exists (select 1 from public.users u where u.id = v_uid and coalesce(u.phone, '') <> '')
  );
end;
$$;

revoke all on function public.share_my_phone(uuid) from public, anon;
revoke all on function public.get_phone_share_status(uuid) from public, anon;
grant execute on function public.share_my_phone(uuid) to authenticated;
grant execute on function public.get_phone_share_status(uuid) to authenticated;
