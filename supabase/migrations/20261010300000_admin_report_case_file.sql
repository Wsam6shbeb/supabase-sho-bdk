-- Full case file for the admin when reviewing a report: both parties (phones, ratings, previous reports, who shared
-- their number), the timeline, the ratings of this request and the conversation. Every view/decision is audit-logged.

create or replace function public.admin_get_report_case(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_r public.reports;
  v_ag public.agreements;
  v_sr public.service_requests;
begin
  perform public._require_admin();

  select * into v_r from public.reports where id = p_report_id;
  if not found then
    raise exception 'REPORT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_sr from public.service_requests where id = v_r.request_id;
  select * into v_ag from public.agreements a where a.request_id = v_r.request_id order by a.created_at desc limit 1;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin_view_report_case', 'report', p_report_id, jsonb_build_object('request_id', v_r.request_id));

  return jsonb_build_object(
    'report_id', v_r.id,
    'parties', (
      select coalesce(jsonb_agg(x.j order by x.ord), '[]'::jsonb)
      from (
        select p.ord,
          jsonb_build_object(
            'id', u.id,
            'name', coalesce(nullif(u.full_name, ''), '—'),
            'phone', u.phone,
            'role', case when u.id = v_ag.requester_id then 'زبون' when u.id = v_ag.provider_id then 'مقدم خدمة' else null end,
            'is_reporter', u.id = v_r.reporter_id,
            'rating_avg', u.rating_avg,
            'rating_count', u.rating_count,
            'shared_phone', v_ag.id is not null and exists (
              select 1 from public.phone_shares s where s.agreement_id = v_ag.id and s.from_user_id = u.id),
            'reports_against', (select count(*) from public.reports x2 where x2.target_user_id = u.id and x2.id <> v_r.id)
          ) as j
        from (values (1, v_r.reporter_id), (2, v_r.target_user_id)) as p(ord, uid)
        join public.users u on u.id = p.uid
      ) x
    ),
    'timeline', jsonb_build_object(
      'agreement_created_at', v_ag.created_at,
      'agreement_responded_at', v_ag.responded_at,
      'provider_finished_at', v_sr.provider_finished_at,
      'completed_at', v_sr.completed_at,
      'report_created_at', v_r.created_at,
      'request_state', v_sr.state::text
    ),
    'ratings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'from_name', coalesce(nullif(fu.full_name, ''), '—'),
               'to_name', coalesce(nullif(tu.full_name, ''), '—'),
               'score', r.score, 'comment', r.comment, 'created_at', r.created_at) order by r.created_at)
        from public.ratings r
        join public.users fu on fu.id = r.from_user_id
        join public.users tu on tu.id = r.to_user_id
       where r.request_id = v_r.request_id), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(m.j order by m.created_at)
        from (
          select ms.created_at,
                 jsonb_build_object(
                   'sender', case when ms.message_type::text = 'system' then 'النظام'
                                  else coalesce(nullif(su.full_name, ''), '—') end,
                   'body', ms.body,
                   'created_at', ms.created_at,
                   'is_system', ms.message_type::text = 'system') as j
            from public.messages ms
            left join public.users su on su.id = ms.sender_id
           where ms.conversation_id = v_ag.conversation_id
           order by ms.created_at desc
           limit 80
        ) m), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_get_report_case(uuid) from public, anon;
grant execute on function public.admin_get_report_case(uuid) to authenticated;

-- Resolution decisions are audit-logged too.
create or replace function public.admin_resolve_report(p_report_id uuid, p_refund boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_r public.reports;
  v_ag public.agreements;
  v_balance numeric;
  v_refunded boolean := false;
begin
  perform public._require_admin();

  select * into v_r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'REPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_r.status in ('resolved', 'dismissed') then
    raise exception 'ALREADY_RESOLVED' using errcode = 'P0001';
  end if;

  if p_refund then
    select * into v_ag from public.agreements a where a.request_id = v_r.request_id order by a.created_at desc limit 1;
    if not found or coalesce(v_ag.commission_amount, 0) <= 0 then
      raise exception 'NO_COMMISSION_TO_REFUND' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.ledger_entries where idempotency_key = 'agreement_commission_' || v_ag.id::text) then
      raise exception 'COMMISSION_NOT_CHARGED' using errcode = 'P0001';
    end if;
    -- Idempotent per agreement: a second refund attempt returns NULL and changes nothing.
    v_balance := public._credit_wallet(
      v_ag.provider_id, v_ag.commission_amount, 'refund_credit', 'agreement', v_ag.id,
      'commission_refund_' || v_ag.id::text);
    v_refunded := v_balance is not null;
  end if;

  update public.reports
     set status = (case when p_refund then 'resolved' else 'dismissed' end)::public.report_status,
         resolution = case when p_refund then 'commission_refunded' else 'no_refund' end,
         resolved_by = auth.uid(),
         resolved_at = now(),
         resolution_note = nullif(btrim(p_note), '')
   where id = p_report_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin_resolve_report', 'report', p_report_id,
          jsonb_build_object('refund', p_refund, 'refunded', v_refunded, 'note', nullif(btrim(p_note), '')));

  return jsonb_build_object('report_id', p_report_id, 'refunded', v_refunded);
end;
$$;
