-- Phase 3: requests/agreements viewer + owner-only intervention, wallet ledger viewer + owner-only audited adjustment.

insert into public.app_settings (key, value) values ('admin_adjust_wallet_max', '100000'::jsonb)
on conflict (key) do nothing;

create or replace function public._like_escape(p text)
returns text
language sql
immutable
as $$ select regexp_replace(coalesce(p, ''), '([\\%_])', '\\\1', 'g') $$;

-- 1) Requests list ---------------------------------------------------------------------------------------------
create or replace function public.admin_list_requests(
  p_state text default null, p_q text default null, p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_limit int := least(100, greatest(1, coalesce(p_limit, 25)));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_q text := btrim(coalesce(p_q, ''));
  v_like text;
  v_total bigint;
  v_rows jsonb;
begin
  perform public._require_admin();
  v_like := '%' || public._like_escape(v_q) || '%';

  with base as (
    select sr.id, sr.created_at, sr.state::text as state, left(sr.raw_text, 160) as raw_text, sr.region,
           sr.completed_at, sr.provider_finished_at,
           ag.id as agreement_id, ag.state::text as agreement_state, ag.price, ag.commission_amount,
           coalesce(nullif(ru.full_name, ''), '—') as requester_name,
           coalesce(nullif(pu.full_name, ''), '—') as provider_name
      from public.service_requests sr
      left join lateral (
        select a.* from public.agreements a where a.request_id = sr.id order by a.created_at desc limit 1
      ) ag on true
      left join public.users ru on ru.id = sr.requester_id
      left join public.users pu on pu.id = ag.provider_id
     where (coalesce(p_state, '') in ('', 'all') or sr.state::text = p_state)
       and (v_q = '' or sr.raw_text ilike v_like or ru.full_name ilike v_like or pu.full_name ilike v_like
            or starts_with(sr.id::text, lower(v_q)))
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
                     from (select * from base order by created_at desc limit v_limit offset v_offset) x), '[]'::jsonb)
    into v_total, v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
end;
$$;

-- 2) One request in full (audit-logged) ---------------------------------------------------------------------------
create or replace function public.admin_get_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sr public.service_requests;
  v_conv uuid;
begin
  perform public._require_admin();
  select * into v_sr from public.service_requests where id = p_request_id;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  select a.conversation_id into v_conv from public.agreements a
   where a.request_id = p_request_id order by a.created_at desc limit 1;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin_view_request', 'service_request', p_request_id, '{}'::jsonb);

  return jsonb_build_object(
    'request', jsonb_build_object(
      'id', v_sr.id, 'state', v_sr.state::text, 'raw_text', v_sr.raw_text, 'region', v_sr.region,
      'created_at', v_sr.created_at, 'completed_at', v_sr.completed_at,
      'provider_finished_at', v_sr.provider_finished_at,
      'requester', (select jsonb_build_object('id', u.id, 'name', u.full_name, 'phone', u.phone)
                      from public.users u where u.id = v_sr.requester_id)),
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'state', a.state::text, 'price', a.price, 'commission_amount', a.commission_amount,
               'currency', a.currency, 'created_at', a.created_at, 'responded_at', a.responded_at,
               'provider', (select jsonb_build_object('id', u.id, 'name', u.full_name, 'phone', u.phone)
                              from public.users u where u.id = a.provider_id),
               'ledger', coalesce((select jsonb_agg(jsonb_build_object(
                                     'type', le.entry_type::text, 'amount', le.amount, 'at', le.created_at)
                                   order by le.created_at)
                                     from public.ledger_entries le where le.reference_id = a.id), '[]'::jsonb))
             order by a.created_at desc)
        from public.agreements a where a.request_id = p_request_id), '[]'::jsonb),
    'ratings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'from_name', coalesce(nullif(fu.full_name, ''), '—'), 'to_name', coalesce(nullif(tu.full_name, ''), '—'),
               'score', r.score, 'comment', r.comment, 'created_at', r.created_at) order by r.created_at)
        from public.ratings r
        join public.users fu on fu.id = r.from_user_id
        join public.users tu on tu.id = r.to_user_id
       where r.request_id = p_request_id), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', rp.id, 'status', rp.status::text, 'reason', rp.reason, 'details', rp.details,
               'created_at', rp.created_at, 'reporter', coalesce(nullif(ru.full_name, ''), '—'),
               'target', coalesce(nullif(tu.full_name, ''), '—')) order by rp.created_at)
        from public.reports rp
        left join public.users ru on ru.id = rp.reporter_id
        left join public.users tu on tu.id = rp.target_user_id
       where rp.request_id = p_request_id), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(m.j order by m.created_at)
        from (select ms.created_at,
                     jsonb_build_object(
                       'sender', case when ms.message_type::text = 'system' then 'النظام'
                                      else coalesce(nullif(su.full_name, ''), '—') end,
                       'body', ms.body, 'created_at', ms.created_at,
                       'is_system', ms.message_type::text = 'system') as j
                from public.messages ms
                left join public.users su on su.id = ms.sender_id
               where ms.conversation_id = v_conv
               order by ms.created_at desc limit 60) m), '[]'::jsonb)
  );
end;
$$;

-- 3) Owner-only exceptional intervention: force-complete (same effects as the automatic completion) -------------
create or replace function public.admin_force_complete_request(p_request_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sr public.service_requests;
  v_ag public.agreements;
  v_days int;
begin
  perform public._require_owner();
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_sr from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_sr.state::text not in ('active', 'completion_pending_rating') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  select * into v_ag from public.agreements a
   where a.request_id = p_request_id and a.state = 'active' order by a.created_at desc limit 1;
  if not found then
    raise exception 'NO_ACTIVE_AGREEMENT' using errcode = 'P0001';
  end if;

  v_days := coalesce((select (value)::text::integer from public.app_settings
                       where key = 'chat_writable_after_completion_days'), 7);

  update public.service_requests
     set state = 'completed', completed_at = coalesce(completed_at, now())
   where id = p_request_id;
  update public.provider_profiles
     set completed_services_count = completed_services_count + 1
   where user_id = v_ag.provider_id;
  update public.conversations
     set writable_until = now() + make_interval(days => v_days)
   where id = v_ag.conversation_id;
  perform public._post_system_message(v_ag.conversation_id, auth.uid(), 'اعتمدت الإدارة إنهاء الطلب.');

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin_force_complete_request', 'service_request', p_request_id,
          jsonb_build_object('reason', btrim(p_reason), 'previous_state', v_sr.state::text));

  return jsonb_build_object('request_id', p_request_id, 'state', 'completed');
end;
$$;

-- 4) Wallets -------------------------------------------------------------------------------------------------------
create or replace function public.admin_wallet_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'total_balance', coalesce((select sum(available_balance) from public.wallets), 0),
    'wallets_count', (select count(*) from public.wallets),
    'entries_count', (select count(*) from public.ledger_entries),
    'by_type', coalesce((select jsonb_object_agg(t.entry_type, t.total)
                           from (select entry_type::text as entry_type, sum(amount) as total
                                   from public.ledger_entries group by 1) t), '{}'::jsonb));
end;
$$;

create or replace function public.admin_list_ledger(
  p_user uuid default null, p_type text default null, p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_limit int := least(100, greatest(1, coalesce(p_limit, 25)));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_total bigint;
  v_rows jsonb;
begin
  perform public._require_admin();
  with base as (
    select le.id, le.created_at, le.user_id, coalesce(nullif(u.full_name, ''), '—') as user_name,
           le.entry_type::text as entry_type, le.amount, le.currency, le.balance_after,
           le.reference_type, le.reference_id, coalesce(nullif(cb.full_name, ''), null) as created_by_name
      from public.ledger_entries le
      left join public.users u on u.id = le.user_id
      left join public.users cb on cb.id = le.created_by
     where (p_user is null or le.user_id = p_user)
       and (coalesce(p_type, '') in ('', 'all') or le.entry_type::text = p_type)
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
                     from (select * from base order by created_at desc limit v_limit offset v_offset) x), '[]'::jsonb)
    into v_total, v_rows;
  return jsonb_build_object('total', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
end;
$$;

create or replace function public.admin_adjust_wallet(p_user uuid, p_amount numeric, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max numeric;
  v_w public.wallets;
  v_new numeric;
  v_ref uuid := gen_random_uuid();
  v_ledger uuid;
begin
  perform public._require_owner();
  if p_amount is null or p_amount = 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  v_max := coalesce((select (value)::text::numeric from public.app_settings where key = 'admin_adjust_wallet_max'), 100000);
  if abs(p_amount) > v_max then
    raise exception 'AMOUNT_TOO_LARGE' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_w from public.wallets where user_id = p_user for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_new := v_w.available_balance + p_amount;
  if v_new < 0 then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;

  update public.wallets set available_balance = v_new, updated_at = now() where user_id = p_user;

  insert into public.ledger_entries
    (user_id, entry_type, amount, currency, balance_after, reference_type, reference_id, idempotency_key, created_by)
  values
    (p_user,
     (case when p_amount > 0 then 'adjustment_credit' else 'adjustment_debit' end)::public.ledger_entry_type,
     abs(p_amount), v_w.currency, v_new, 'admin_adjustment', v_ref, 'admin_adjust_' || v_ref::text, auth.uid())
  returning id into v_ledger;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin_adjust_wallet', 'user', p_user,
          jsonb_build_object('amount', p_amount, 'balance_after', v_new, 'reason', btrim(p_reason), 'ledger_id', v_ledger));

  return jsonb_build_object('user_id', p_user, 'balance_after', v_new, 'ledger_id', v_ledger);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_list_requests(text, text, int, int)', 'public.admin_get_request(uuid)',
    'public.admin_force_complete_request(uuid, text)', 'public.admin_wallet_summary()',
    'public.admin_list_ledger(uuid, text, int, int)', 'public.admin_adjust_wallet(uuid, numeric, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;;
