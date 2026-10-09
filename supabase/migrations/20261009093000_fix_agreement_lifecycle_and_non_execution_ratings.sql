-- Align agreement locking and permit ratings after a recorded non-execution report.
-- This migration is committed to the feature branch only; it is not applied to production.

create or replace function public.approve_agreement(p_agreement_id uuid, p_provider_id uuid)
returns public.agreements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agreement public.agreements;
  v_wallet public.wallets;
begin
  select * into v_agreement from public.agreements where id = p_agreement_id for update;
  if not found then
    raise exception 'AGREEMENT_NOT_FOUND';
  end if;

  if v_agreement.provider_id <> p_provider_id then
    raise exception 'FORBIDDEN';
  end if;

  -- Idempotent: repeated approval returns the current state without duplicate charges.
  if v_agreement.state <> 'pending' then
    return v_agreement;
  end if;

  if v_agreement.expires_at < now() then
    update public.agreements set state = 'expired' where id = p_agreement_id
      returning * into v_agreement;
    update public.service_requests set state = 'negotiating' where id = v_agreement.request_id;
    update public.conversations set state = 'negotiating', locked_reason = null
      where request_id = v_agreement.request_id and state = 'locked_temp';
    return v_agreement;
  end if;

  select * into v_wallet from public.wallets where user_id = p_provider_id for update;
  if v_wallet.available_balance < v_agreement.commission_amount then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update public.wallets
    set available_balance = available_balance - v_agreement.commission_amount,
        updated_at = now()
    where user_id = p_provider_id;

  insert into public.ledger_entries(
    user_id, entry_type, amount, currency, balance_after,
    reference_type, reference_id, idempotency_key
  ) values (
    p_provider_id, 'commission_debit', v_agreement.commission_amount, v_agreement.currency,
    v_wallet.available_balance - v_agreement.commission_amount,
    'agreement', v_agreement.id,
    'agreement_commission_' || v_agreement.id::text
  ) on conflict (idempotency_key) do nothing;

  update public.agreements
    set state = 'active', responded_at = now()
    where id = p_agreement_id
    returning * into v_agreement;

  update public.service_requests set state = 'active' where id = v_agreement.request_id;
  update public.conversations set state = 'active', locked_reason = null
    where id = v_agreement.conversation_id;

  -- Once one provider accepts, all other negotiations for this request become read-only.
  update public.conversations
    set state = 'read_only', locked_reason = 'request_agreed'
    where request_id = v_agreement.request_id
      and id <> v_agreement.conversation_id
      and state in ('locked_temp', 'negotiating', 'agreement_pending');

  return v_agreement;
end;
$$;

create or replace function public.submit_rating(
  p_request_id uuid,
  p_score integer,
  p_comment text default null,
  p_tags text[] default null
)
returns public.ratings
language plpgsql
security definer
set search_path = public
as $$
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

  return v_rating;
end;
$$;

create or replace function public.get_my_order_history()
returns table(
  request_id uuid,
  description text,
  state text,
  region text,
  is_urgent boolean,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz,
  rating_deadline timestamptz,
  provider_id uuid,
  provider_name text,
  agreed_price numeric,
  commission_amount numeric,
  my_rating integer,
  my_comment text,
  my_tags text[]
)
language sql
security definer
set search_path = public
as $$
  select
    sr.id,
    sr.raw_text,
    sr.state::text,
    sr.region,
    sr.urgency::text = 'urgent',
    sr.created_at,
    sr.updated_at,
    sr.completed_at,
    case when sr.state = 'completion_pending_rating'
         then sr.completed_at + make_interval(hours => coalesce(
              (select (value)::text::integer from public.app_settings where key = 'rating_window_hours'), 48))
    end,
    a.provider_id,
    u.full_name,
    a.price,
    a.commission_amount,
    r.score::int,
    r.comment,
    r.tags
  from public.service_requests sr
  left join lateral (
    select * from public.agreements ag
     where ag.request_id = sr.id
       and (
         ag.state = 'active'
         or (ag.state = 'cancelled' and exists (
           select 1 from public.reports rep
            where rep.request_id = sr.id and rep.reason = 'non_execution'
         ))
       )
     order by ag.created_at desc limit 1
  ) a on true
  left join public.users u on u.id = a.provider_id
  left join public.ratings r on r.request_id = sr.id and r.from_user_id = auth.uid()
  where sr.requester_id = auth.uid()
    and sr.state in ('completion_pending_rating', 'completed', 'cancelled', 'expired')
  order by coalesce(sr.completed_at, sr.updated_at) desc;
$$;
