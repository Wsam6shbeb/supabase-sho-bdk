-- Phone foundation: normalized E.164 Syrian mobile numbers, ready for a future OTP verification / phone login,
-- plus secure per-direction sharing of a user's number with the other party of an agreement.

-- 1) Normalization: accepts 09XXXXXXXX, 9XXXXXXXX, +9639XXXXXXXX, 009639XXXXXXXX, with spaces/dashes and Arabic-Indic digits.
create or replace function public.normalize_syrian_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if p_phone is null then
    return null;
  end if;
  d := translate(p_phone, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  d := regexp_replace(d, '[^0-9]', '', 'g');
  if d like '00963%' then
    d := substr(d, 6);
  elsif d like '963%' then
    d := substr(d, 4);
  elsif d like '0%' then
    d := substr(d, 2);
  end if;
  if d ~ '^9[0-9]{8}$' then
    return '+963' || d;
  end if;
  return null;
end;
$$;

-- 2) Verification marker (set by a future OTP flow; reset whenever the number changes).
alter table public.users add column if not exists phone_verified_at timestamptz;

-- 3) Any write to users.phone is validated + normalized, whatever path the client uses.
create or replace function public.users_normalize_phone()
returns trigger
language plpgsql
as $$
begin
  if new.phone is null or btrim(new.phone) = '' then
    new.phone := null;
  elsif tg_op = 'INSERT' or new.phone is distinct from old.phone then
    new.phone := public.normalize_syrian_phone(new.phone);
    if new.phone is null then
      raise exception 'INVALID_PHONE' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.phone is distinct from old.phone then
    new.phone_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists users_normalize_phone_trg on public.users;
create trigger users_normalize_phone_trg
  before insert or update of phone on public.users
  for each row execute function public.users_normalize_phone();

-- Normalize numbers already stored (only those that can be normalized).
update public.users set phone = public.normalize_syrian_phone(phone)
 where coalesce(phone, '') <> '' and public.normalize_syrian_phone(phone) is not null
   and phone is distinct from public.normalize_syrian_phone(phone);

-- A verified number can belong to only one account (needed once phone login exists).
create unique index if not exists users_phone_verified_unique
  on public.users (phone) where phone_verified_at is not null;

-- 4) set_my_phone: the single entry point the app uses to save the user's number.
create or replace function public.set_my_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if public.normalize_syrian_phone(p_phone) is null then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  update public.users set phone = p_phone where id = v_uid returning phone into v_phone;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_phone;
end;
$$;

-- 5) Sharing: each side decides by itself to share its number for an agreement.
create table if not exists public.phone_shares (
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agreement_id, from_user_id)
);
alter table public.phone_shares enable row level security;
drop policy if exists phone_shares_select_own on public.phone_shares;
create policy phone_shares_select_own on public.phone_shares
  for select to authenticated using (auth.uid() = from_user_id);
-- No insert/update/delete policies: writes only through share_my_phone().

revoke all on function public.set_my_phone(text) from public, anon;
grant execute on function public.set_my_phone(text) to authenticated;
-- share_my_phone / get_phone_share_status are defined in the next migration (agreement-time sharing).
