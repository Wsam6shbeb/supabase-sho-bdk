-- Manual admin review of reports (e.g. "non-execution"): the admin decides whether the provider's commission is refunded.
-- No automatic refund exists on purpose (a provider could do the job and then report non-execution to get the commission back).

alter table public.reports
  add column if not exists resolution text,
  add column if not exists resolved_by uuid,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text;

create or replace function public._require_admin()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null
     or not exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public._require_admin() from public, anon, authenticated;

create or replace function public.admin_list_reports(p_status text default 'open')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v jsonb;
begin
  perform public._require_admin();

  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) into v
  from (
    select r.created_at,
      jsonb_build_object(
        'id', r.id,
        'status', r.status::text,
        'created_at', r.created_at,
        'reason', r.reason,
        'details', r.details,
        'resolution', r.resolution,
        'resolution_note', r.resolution_note,
        'resolved_at', r.resolved_at,
        'request_id', r.request_id,
        'request_text', sr.raw_text,
        'request_state', sr.state::text,
        'reporter_id', r.reporter_id,
        'reporter_name', coalesce(nullif(ru.full_name, ''), '—'),
        'target_id', r.target_user_id,
        'target_name', coalesce(nullif(tu.full_name, ''), '—'),
        'agreement_id', ag.id,
        'price', ag.price,
        'commission_amount', ag.commission_amount,
        'currency', ag.currency,
        'provider_id', ag.provider_id,
        'provider_name', coalesce(nullif(pu.full_name, ''), '—'),
        'requester_name', coalesce(nullif(cu.full_name, ''), '—'),
        'commission_charged', ag.id is not null and exists (
          select 1 from public.ledger_entries le where le.idempotency_key = 'agreement_commission_' || ag.id::text),
        'commission_refunded', ag.id is not null and exists (
          select 1 from public.ledger_entries le where le.idempotency_key = 'commission_refund_' || ag.id::text)
      ) as j
    from public.reports r
    left join public.service_requests sr on sr.id = r.request_id
    left join public.users ru on ru.id = r.reporter_id
    left join public.users tu on tu.id = r.target_user_id
    left join lateral (
      select a.* from public.agreements a where a.request_id = r.request_id order by a.created_at desc limit 1
    ) ag on true
    left join public.users pu on pu.id = ag.provider_id
    left join public.users cu on cu.id = ag.requester_id
    where p_status = 'all' or r.status::text = p_status
  ) x;

  return v;
end;
$$;

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

  return jsonb_build_object('report_id', p_report_id, 'refunded', v_refunded);
end;
$$;

revoke all on function public.admin_list_reports(text) from public, anon;
revoke all on function public.admin_resolve_report(uuid, boolean, text) from public, anon;
grant execute on function public.admin_list_reports(text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, boolean, text) to authenticated;
