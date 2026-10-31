-- Stable, server-generated user codes for manual Sham Cash top-ups.
alter table public.users add column if not exists topup_code text;

update public.users
set topup_code = 'SHB-' || upper(substr(md5(gen_random_uuid()::text), 1, 10))
where topup_code is null;

create unique index if not exists users_topup_code_unique
  on public.users (topup_code);

create or replace function public.protect_user_topup_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.topup_code is not null then
      raise exception 'TOPUP_CODE_MANAGED_BY_SYSTEM';
    end if;
    if new.topup_code is null then
      new.topup_code := 'SHB-' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
    end if;
  elsif new.topup_code is distinct from old.topup_code then
    if auth.uid() is not null then
      raise exception 'TOPUP_CODE_CANNOT_BE_CHANGED';
    end if;
    if new.topup_code is null then
      raise exception 'TOPUP_CODE_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_user_topup_code on public.users;
create trigger trg_protect_user_topup_code
before insert or update of topup_code on public.users
for each row execute function public.protect_user_topup_code();

-- Store the real Sham Cash transfer reference and enforce global uniqueness.
alter table public.ledger_entries
  add column if not exists sham_cash_transaction_id text;

create unique index if not exists ledger_sham_cash_transaction_unique
  on public.ledger_entries (upper(btrim(sham_cash_transaction_id)))
  where sham_cash_transaction_id is not null;

drop function if exists public.admin_topup_wallet(uuid, numeric, text, uuid);

create function public.admin_topup_wallet(
  p_user uuid,
  p_amount numeric,
  p_reason text,
  p_request_id uuid,
  p_sham_cash_transaction_id text,
  p_thank_you_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_max numeric;
  v_wallet public.wallets;
  v_new numeric;
  v_reference uuid := gen_random_uuid();
  v_ledger uuid;
  v_existing public.ledger_entries;
  v_idempotency_key text;
  v_transaction_id text := upper(btrim(coalesce(p_sham_cash_transaction_id, '')));
  v_thank_you text := nullif(btrim(coalesce(p_thank_you_message, '')), '');
begin
  perform public._require_owner();

  if p_user is null then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 or trunc(p_amount) <> p_amount then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 or length(btrim(p_reason)) > 300 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode = 'P0001'; end if;
  if length(v_transaction_id) < 4 or length(v_transaction_id) > 100
     or v_transaction_id !~ '^[A-Z0-9-]+$' then
    raise exception 'INVALID_SHAM_CASH_TRANSACTION_ID' using errcode = 'P0001';
  end if;

  v_max := coalesce(
    (select (value)::text::numeric from public.app_settings where key = 'admin_adjust_wallet_max'),
    100000
  );
  if p_amount > v_max then raise exception 'AMOUNT_TOO_LARGE' using errcode = 'P0001'; end if;

  if not exists (
    select 1 from public.users
    where id = p_user and status = 'active' and deleted_at is null and is_admin = false
  ) then raise exception 'USER_NOT_ELIGIBLE' using errcode = 'P0001'; end if;

  select * into v_wallet from public.wallets where user_id = p_user for update;
  if not found then raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002'; end if;

  v_idempotency_key := 'manual_topup_' || p_request_id::text;
  select * into v_existing from public.ledger_entries
  where idempotency_key = v_idempotency_key for update;
  if found then
    return jsonb_build_object(
      'user_id', p_user, 'amount', v_existing.amount,
      'balance_after', v_existing.balance_after, 'ledger_id', v_existing.id,
      'already_processed', true
    );
  end if;

  v_new := v_wallet.available_balance + p_amount;
  update public.wallets set available_balance = v_new, updated_at = now()
  where user_id = p_user;

  begin
    insert into public.ledger_entries (
      user_id, entry_type, amount, currency, balance_after,
      reference_type, reference_id, idempotency_key, created_by,
      sham_cash_transaction_id
    ) values (
      p_user, 'topup_credit'::public.ledger_entry_type, p_amount, v_wallet.currency, v_new,
      'manual_topup', v_reference, v_idempotency_key, auth.uid(),
      v_transaction_id
    ) returning id into v_ledger;
  exception when unique_violation then
    raise exception 'DUPLICATE_SHAM_CASH_TRANSACTION' using errcode = 'P0001';
  end;

  insert into public.notifications (user_id, type, payload)
  values (
    p_user, 'wallet_topup',
    jsonb_build_object(
      'title', 'تمت إضافة رصيد',
      'body', coalesce(v_thank_you, 'شكراً لثقتك بنا! تمت إضافة رصيدك بنجاح.'),
      'amount', p_amount, 'balance_after', v_new,
      'route', '/(drawer)/(tabs)/wallet'
    )
  );

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'admin_topup_wallet', 'user', p_user,
    jsonb_build_object(
      'amount', p_amount, 'balance_after', v_new,
      'reason', btrim(p_reason), 'ledger_id', v_ledger,
      'sham_cash_transaction_id', v_transaction_id
    )
  );

  return jsonb_build_object(
    'user_id', p_user, 'amount', p_amount, 'balance_after', v_new,
    'ledger_id', v_ledger, 'already_processed', false
  );
end;
$function$;

revoke all on function public.admin_topup_wallet(uuid, numeric, text, uuid, text, text) from public;
revoke all on function public.admin_topup_wallet(uuid, numeric, text, uuid, text, text) from anon;
grant execute on function public.admin_topup_wallet(uuid, numeric, text, uuid, text, text) to authenticated;
