drop function if exists public.admin_topup_wallet(uuid, numeric, text);

create function public.admin_topup_wallet(
  p_user uuid,
  p_amount numeric,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_max numeric;
  v_wallet public.wallets;
  v_new numeric;
  v_reference uuid := gen_random_uuid();
  v_ledger uuid;
  v_existing public.ledger_entries;
  v_idempotency_key text;
begin
  perform public._require_owner();

  if p_user is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_amount is null or p_amount <= 0 or trunc(p_amount) <> p_amount then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 or length(btrim(p_reason)) > 300 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_request_id is null then
    raise exception 'REQUEST_ID_REQUIRED' using errcode = 'P0001';
  end if;

  v_max := coalesce(
    (select (value)::text::numeric from public.app_settings where key = 'admin_adjust_wallet_max'),
    100000
  );
  if p_amount > v_max then
    raise exception 'AMOUNT_TOO_LARGE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_user
      and status = 'active'
      and deleted_at is null
      and is_admin = false
  ) then
    raise exception 'USER_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  select * into v_wallet
  from public.wallets
  where user_id = p_user
  for update;

  if not found then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_idempotency_key := 'manual_topup_' || p_request_id::text;
  select * into v_existing
  from public.ledger_entries
  where idempotency_key = v_idempotency_key
  for update;

  if found then
    return jsonb_build_object(
      'user_id', p_user,
      'amount', v_existing.amount,
      'balance_after', v_existing.balance_after,
      'ledger_id', v_existing.id,
      'already_processed', true
    );
  end if;

  v_new := v_wallet.available_balance + p_amount;

  update public.wallets
  set available_balance = v_new, updated_at = now()
  where user_id = p_user;

  insert into public.ledger_entries (
    user_id, entry_type, amount, currency, balance_after,
    reference_type, reference_id, idempotency_key, created_by
  ) values (
    p_user, 'topup_credit'::public.ledger_entry_type, p_amount, v_wallet.currency, v_new,
    'manual_topup', v_reference, v_idempotency_key, auth.uid()
  )
  returning id into v_ledger;

  insert into public.notifications (user_id, type, payload)
  values (
    p_user,
    'wallet_topup',
    jsonb_build_object(
      'title', 'تمت إضافة رصيد',
      'body', 'تمت إضافة ' || to_char(p_amount, 'FM999999999990') || ' ليرة سورية إلى رصيدك.',
      'amount', p_amount,
      'balance_after', v_new,
      'route', '/(drawer)/(tabs)/wallet'
    )
  );

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'admin_topup_wallet',
    'user',
    p_user,
    jsonb_build_object(
      'amount', p_amount,
      'balance_after', v_new,
      'reason', btrim(p_reason),
      'ledger_id', v_ledger
    )
  );

  return jsonb_build_object(
    'user_id', p_user,
    'amount', p_amount,
    'balance_after', v_new,
    'ledger_id', v_ledger,
    'already_processed', false
  );
end;
$function$;

revoke all on function public.admin_topup_wallet(uuid, numeric, text, uuid) from public;
revoke all on function public.admin_topup_wallet(uuid, numeric, text, uuid) from anon;
grant execute on function public.admin_topup_wallet(uuid, numeric, text, uuid) to authenticated;
