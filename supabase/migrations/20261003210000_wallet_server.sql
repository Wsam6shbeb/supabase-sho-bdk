-- ============================================================
-- Phase H: real wallet operations on the server.
--
-- Before: top-up and the welcome bonus only changed a number inside the app
-- (never the wallets table), so providers always had a server balance of 0 and
-- every agreement approval failed with INSUFFICIENT_BALANCE.
-- Now credits are ledger-backed, idempotent and executed by SECURITY DEFINER RPCs.
-- ============================================================

-- internal: credit a wallet + write the ledger entry once per idempotency key
CREATE OR REPLACE FUNCTION public._credit_wallet(
  p_user uuid,
  p_amount numeric,
  p_type public.ledger_entry_type,
  p_reference_type text,
  p_reference_id uuid,
  p_key text
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_key));
  if exists (select 1 from ledger_entries where idempotency_key = p_key) then
    return null; -- already applied
  end if;

  update wallets
     set available_balance = available_balance + p_amount, updated_at = now()
   where user_id = p_user
   returning available_balance into v_balance;
  if not found then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into ledger_entries (user_id, entry_type, amount, balance_after, reference_type, reference_id, idempotency_key, created_by)
  values (p_user, p_type, p_amount, v_balance, p_reference_type, p_reference_id, p_key, p_user);

  return v_balance;
end;
$$;
REVOKE ALL ON FUNCTION public._credit_wallet(uuid, numeric, public.ledger_entry_type, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- one-time welcome bonus for a user who has registered at least one active service
CREATE OR REPLACE FUNCTION public.claim_welcome_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_amount numeric;
  v_new numeric;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if not exists (select 1 from provider_services where provider_id = v_uid and is_active) then
    raise exception 'NOT_A_PROVIDER' using errcode = 'P0001';
  end if;

  v_amount := coalesce((select (value)::text::numeric from app_settings where key = 'signup_bonus_amount'), 0);
  if v_amount <= 0 then
    return jsonb_build_object('granted', false, 'amount', 0,
      'balance', (select available_balance from wallets where user_id = v_uid));
  end if;

  v_new := public._credit_wallet(v_uid, v_amount, 'bonus_credit', 'welcome_bonus', null, 'welcome_bonus:' || v_uid::text);

  return jsonb_build_object(
    'granted', v_new is not null,
    'amount', v_amount,
    'balance', coalesce(v_new, (select available_balance from wallets where user_id = v_uid)));
end;
$$;

-- test top-up: disabled unless an admin sets app_settings.test_topup_enabled = true
-- (no payment gateway is integrated yet; never enable in production)
INSERT INTO public.app_settings (key, value)
VALUES ('test_topup_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.request_test_topup(p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_new numeric;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if coalesce((select (value)::text::boolean from app_settings where key = 'test_topup_enabled'), false) is not true then
    raise exception 'TOPUP_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  v_new := public._credit_wallet(v_uid, p_amount, 'topup_credit', 'test_topup', null,
                                 'test_topup:' || gen_random_uuid()::text);
  return v_new;
end;
$$;

REVOKE ALL ON FUNCTION public.claim_welcome_bonus() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_test_topup(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_welcome_bonus() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_test_topup(numeric) TO authenticated;

-- live balance/ledger in the app (RLS: each user receives only their own rows)
DO $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallets') then
    alter publication supabase_realtime add table public.wallets;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ledger_entries') then
    alter publication supabase_realtime add table public.ledger_entries;
  end if;
end $$;
