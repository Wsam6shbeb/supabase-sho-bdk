insert into public.app_settings (key, value)
values
  ('sham_cash_account_code', to_jsonb(''::text)),
  ('sham_cash_qr_path', to_jsonb(''::text)),
  ('manual_topup_enabled', 'false'::jsonb)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-assets',
  'payment-assets',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.admin_topup_wallet(
  p_user uuid,
  p_amount numeric,
  p_reason text
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

  v_new := v_wallet.available_balance + p_amount;

  update public.wallets
  set available_balance = v_new, updated_at = now()
  where user_id = p_user;

  insert into public.ledger_entries (
    user_id, entry_type, amount, currency, balance_after,
    reference_type, reference_id, idempotency_key, created_by
  ) values (
    p_user, 'topup_credit'::public.ledger_entry_type, p_amount, v_wallet.currency, v_new,
    'manual_topup', v_reference, 'manual_topup_' || v_reference::text, auth.uid()
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
    'ledger_id', v_ledger
  );
end;
$function$;

revoke all on function public.admin_topup_wallet(uuid, numeric, text) from public;
revoke all on function public.admin_topup_wallet(uuid, numeric, text) from anon;
grant execute on function public.admin_topup_wallet(uuid, numeric, text) to authenticated;
