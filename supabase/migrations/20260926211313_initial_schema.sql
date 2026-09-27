-- ============================================================================
-- شو بدك؟ — Database Schema (PostgreSQL / Supabase)
-- مبني على: 01 Product Spec, 02 UX/UI Spec, 03 Technical Spec, 04 QA Spec
-- ملاحظة: القرارات المثبتة في PRD §23 مطبّقة هنا كقيم افتراضية في app_settings:
--   الدولة: سوريا | العملة: SYP | مزود الدفع: شام كاش (خارج نطاق الـMVP التقني)
--   الحد الأدنى للعمولة: 50 | الحد الأعلى: 1000 | مكافأة الانضمام: 300 (غير قابلة للسحب)
--   منطقة الإطلاق: اللاذقية
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1) ENUMS — مطابقة لحالات State Machine في §5 و§6 و§7 من الوثيقة التقنية
-- ============================================================================

create type verification_status as enum ('pending','approved','rejected');

create type request_state as enum (
  'draft','submitted','clarification','matching','candidates_ready',
  'negotiating','agreement_pending_provider','active',
  'completion_pending_rating','completed','cancelled','expired'
);

create type request_urgency as enum ('normal','urgent');

create type conversation_state as enum (
  'negotiating','agreement_pending','active','locked_temp','read_only'
);

create type agreement_state as enum ('pending','active','rejected','expired','cancelled');

create type ledger_entry_type as enum (
  'commission_debit','topup_credit','bonus_credit',
  'refund_credit','adjustment_credit','adjustment_debit'
);

create type report_status as enum ('open','reviewed','resolved','dismissed');

create type message_type as enum ('text','system');

-- ============================================================================
-- 2) app_settings — القيم القابلة للتغيير دون إعادة نشر (§11 من الوثيقة التقنية)
-- ============================================================================

create table app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into app_settings(key, value) values
  ('currency',                              '"SYP"'),
  ('commission_min',                        '50'),
  ('commission_max',                        '1000'),
  ('commission_default',                    '100'),
  ('agreement_approval_timeout_seconds',    '240'),
  ('rating_window_hours',                   '48'),
  ('chat_writable_after_completion_days',   '7'),
  ('notification_retention_days',           '30'),
  ('signup_bonus_amount',                   '300'),
  ('launch_region',                         '"اللاذقية"')
on conflict (key) do nothing;

-- ============================================================================
-- 3) المستخدمون والملفات الشخصية
-- ============================================================================

create table users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text not null,
  phone                 text unique,
  region                text,
  avatar_url            text,
  is_provider           boolean not null default false,
  is_admin              boolean not null default false,
  verification_status   verification_status not null default 'pending',
  status                text not null default 'active'
                        check (status in ('active','suspended','deleted')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table provider_profiles (
  user_id                   uuid primary key references users(id) on delete cascade,
  bio                       text,
  is_available              boolean not null default true,
  rating_avg                numeric(3,2) not null default 0,
  completed_services_count  integer not null default 0,
  commitment_rate           numeric(5,2),
  response_speed_avg_sec    integer,
  cancellations_count       integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table skills (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique
);

create table provider_skills (
  provider_id  uuid not null references provider_profiles(user_id) on delete cascade,
  skill_id     uuid not null references skills(id) on delete cascade,
  primary key (provider_id, skill_id)
);

-- ============================================================================
-- 4) المحفظة والعمولة (§11 و§13 من PRD)
-- ============================================================================

create table wallets (
  user_id             uuid primary key references users(id) on delete cascade,
  currency            text not null default 'SYP',
  available_balance   numeric(14,2) not null default 0 check (available_balance >= 0),
  updated_at          timestamptz not null default now()
);

create table ledger_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id),
  entry_type       ledger_entry_type not null,
  amount           numeric(14,2) not null check (amount > 0),
  currency         text not null default 'SYP',
  balance_after    numeric(14,2) not null,
  reference_type   text,
  reference_id     uuid,
  idempotency_key  text not null unique,
  created_by       uuid references users(id),
  created_at       timestamptz not null default now()
);

create index idx_ledger_user_created on ledger_entries(user_id, created_at desc);

-- ============================================================================
-- 5) الطلبات والمرشحون (§5، §8، §9 من الوثيقة التقنية)
-- ============================================================================

create table service_requests (
  id                     uuid primary key default gen_random_uuid(),
  requester_id           uuid not null references users(id),
  raw_text               text not null,
  structured_data        jsonb,
  urgency                request_urgency not null default 'normal',
  region                 text,
  state                  request_state not null default 'draft',
  needs_clarification    boolean not null default false,
  clarification_question text,
  ai_confidence          numeric(4,3),
  matched_at             timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_requests_requester on service_requests(requester_id);
create index idx_requests_state on service_requests(state);

create table candidates (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references service_requests(id) on delete cascade,
  provider_id      uuid not null references provider_profiles(user_id),
  rank             integer not null,
  match_score      numeric(6,3),
  match_metadata   jsonb,
  excluded_reason  text,
  created_at       timestamptz not null default now(),
  unique (request_id, provider_id)
);

create index idx_candidates_request_rank on candidates(request_id, rank);

-- ============================================================================
-- 6) المحادثات والرسائل (§7 من الوثيقة التقنية + §10 من UX)
-- ============================================================================

create table conversations (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references service_requests(id) on delete cascade,
  requester_id    uuid not null references users(id),
  provider_id     uuid not null references provider_profiles(user_id),
  state           conversation_state not null default 'negotiating',
  locked_reason   text,
  writable_until  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (request_id, provider_id)
);

create index idx_conversations_request on conversations(request_id);
create index idx_conversations_provider on conversations(provider_id);

-- فرض حد 3 محادثات متزامنة لكل طلب على مستوى الخادم (§7، CHAT-02/03)
create or replace function enforce_conversation_limit() returns trigger as $$
declare
  open_count integer;
begin
  select count(*) into open_count
  from conversations
  where request_id = new.request_id
    and state in ('negotiating','agreement_pending','active','locked_temp');

  if open_count >= 3 then
    raise exception 'CONVERSATION_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_conversation_limit
before insert on conversations
for each row execute function enforce_conversation_limit();

create table messages (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references conversations(id) on delete cascade,
  sender_id          uuid not null references users(id),
  body               text not null,
  message_type       message_type not null default 'text',
  client_dedupe_key  text,
  created_at         timestamptz not null default now(),
  unique (conversation_id, client_dedupe_key)
);

create index idx_messages_conversation_created on messages(conversation_id, created_at);

-- ============================================================================
-- 7) الاتفاقات (§6 من الوثيقة التقنية) — القلب الحساس ماليًا وتزامنيًا
-- ============================================================================

create table agreements (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid not null references service_requests(id),
  conversation_id    uuid not null references conversations(id),
  requester_id       uuid not null references users(id),
  provider_id        uuid not null references provider_profiles(user_id),
  price              numeric(14,2),
  price_confidence   numeric(4,3),
  price_source       text check (price_source in ('ai_extracted','user_confirmed','default')),
  commission_amount  numeric(14,2) not null check (commission_amount between 50 and 1000),
  currency           text not null default 'SYP',
  state              agreement_state not null default 'pending',
  phone_shared       boolean not null default false,
  expires_at         timestamptz not null,
  responded_at       timestamptz,
  rejection_reason   text,
  created_at         timestamptz not null default now()
);

create index idx_agreements_request on agreements(request_id);
create index idx_agreements_provider on agreements(provider_id);

-- لا يجوز وجود أكثر من اتفاق نشط أو بانتظار موافقة على الطلب نفسه (PRD §8)
create unique index uq_one_open_agreement_per_request
  on agreements(request_id)
  where state in ('pending','active');

-- ---- إنشاء اتفاق (تم الاتفاق) ------------------------------------------------
create or replace function create_agreement(
  p_request_id       uuid,
  p_conversation_id  uuid,
  p_requester_id     uuid,
  p_provider_id      uuid,
  p_price            numeric,
  p_price_source     text,
  p_commission       numeric
) returns agreements as $$
declare
  v_agreement       agreements;
  v_timeout_seconds integer;
begin
  select (value)::text::integer into v_timeout_seconds
  from app_settings where key = 'agreement_approval_timeout_seconds';

  if v_timeout_seconds is null then
    v_timeout_seconds := 240;
  end if;

  insert into agreements(
    request_id, conversation_id, requester_id, provider_id,
    price, price_source, commission_amount, expires_at
  ) values (
    p_request_id, p_conversation_id, p_requester_id, p_provider_id,
    p_price, p_price_source, p_commission,
    now() + (v_timeout_seconds || ' seconds')::interval
  ) returning * into v_agreement;

  update service_requests
    set state = 'agreement_pending_provider'
    where id = p_request_id;

  update conversations
    set state = 'agreement_pending'
    where id = p_conversation_id;

  -- تُصبح المحادثات الأخرى للقراءة فقط مؤقتًا (PRD §10)
  update conversations
    set state = 'locked_temp', locked_reason = 'other_conversation_pending_agreement'
    where request_id = p_request_id
      and id <> p_conversation_id
      and state = 'negotiating';

  return v_agreement;
end;
$$ language plpgsql security definer;

-- ---- الموافقة (ذرّية، Idempotent) — AGR-03/06/07, WAL-01/02/03/04 -----------
create or replace function approve_agreement(
  p_agreement_id uuid,
  p_provider_id  uuid
) returns agreements as $$
declare
  v_agreement agreements;
  v_wallet    wallets;
begin
  select * into v_agreement from agreements where id = p_agreement_id for update;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND';
  end if;

  if v_agreement.provider_id <> p_provider_id then
    raise exception 'FORBIDDEN';
  end if;

  -- Idempotent: أي طلب موافقة ثانٍ (ضغط مرتين أو تزامن) يعيد الحالة الحالية دون أثر
  if v_agreement.state <> 'pending' then
    return v_agreement;
  end if;

  if v_agreement.expires_at < now() then
    update agreements set state = 'expired' where id = p_agreement_id
      returning * into v_agreement;
    update service_requests set state = 'negotiating' where id = v_agreement.request_id;
    update conversations set state = 'negotiating', locked_reason = null
      where request_id = v_agreement.request_id and state = 'locked_temp';
    return v_agreement;
  end if;

  select * into v_wallet from wallets where user_id = p_provider_id for update;

  if v_wallet.available_balance < v_agreement.commission_amount then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update wallets
    set available_balance = available_balance - v_agreement.commission_amount,
        updated_at = now()
    where user_id = p_provider_id;

  insert into ledger_entries(
    user_id, entry_type, amount, currency, balance_after,
    reference_type, reference_id, idempotency_key
  ) values (
    p_provider_id, 'commission_debit', v_agreement.commission_amount, v_agreement.currency,
    v_wallet.available_balance - v_agreement.commission_amount,
    'agreement', v_agreement.id,
    'agreement_commission_' || v_agreement.id::text
  ) on conflict (idempotency_key) do nothing;

  update agreements
    set state = 'active', responded_at = now()
    where id = p_agreement_id
    returning * into v_agreement;

  update service_requests set state = 'active' where id = v_agreement.request_id;
  update conversations set state = 'active' where id = v_agreement.conversation_id;

  update conversations
    set state = 'negotiating', locked_reason = null
    where request_id = v_agreement.request_id
      and id <> v_agreement.conversation_id
      and state = 'locked_temp';

  return v_agreement;
end;
$$ language plpgsql security definer;

-- ---- الرفض (Idempotent) ------------------------------------------------------
create or replace function reject_agreement(
  p_agreement_id uuid,
  p_provider_id  uuid,
  p_reason       text default null
) returns agreements as $$
declare
  v_agreement agreements;
begin
  select * into v_agreement from agreements where id = p_agreement_id for update;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND';
  end if;

  if v_agreement.provider_id <> p_provider_id then
    raise exception 'FORBIDDEN';
  end if;

  if v_agreement.state <> 'pending' then
    return v_agreement;
  end if;

  update agreements
    set state = 'rejected', responded_at = now(), rejection_reason = p_reason
    where id = p_agreement_id
    returning * into v_agreement;

  update service_requests set state = 'negotiating' where id = v_agreement.request_id;

  update conversations
    set state = 'negotiating', locked_reason = null
    where request_id = v_agreement.request_id
      and state in ('locked_temp','agreement_pending');

  return v_agreement;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- 8) التقييمات (§14 من PRD)
-- ============================================================================

create table ratings (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references service_requests(id),
  from_user_id    uuid not null references users(id),
  to_user_id      uuid not null references users(id),
  score           smallint not null check (score between 1 and 5),
  comment         text,
  tags            text[],
  auto_completed  boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (request_id, from_user_id)
);

-- ============================================================================
-- 9) التوثيق (§15 من PRD)
-- ============================================================================

create table verifications (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id),
  id_document_url    text,
  selfie_url         text,
  status             verification_status not null default 'pending',
  rejection_reason   text,
  reviewed_by        uuid references users(id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index idx_verifications_user_created on verifications(user_id, created_at desc);

-- ============================================================================
-- 10) الإشعارات (§17 من PRD)
-- ============================================================================

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  type        text not null,
  payload     jsonb not null default '{}',
  read_at     timestamptz,
  expires_at  timestamptz not null default (now() + interval '30 days'),
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_read on notifications(user_id, read_at);

-- ============================================================================
-- 11) البلاغات والحظر (§15 من PRD)
-- ============================================================================

create table reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references users(id),
  target_user_id  uuid references users(id),
  request_id      uuid references service_requests(id),
  reason          text not null,
  details         text,
  status          report_status not null default 'open',
  created_at      timestamptz not null default now()
);

create table blocks (
  blocker_id  uuid not null references users(id),
  blocked_id  uuid not null references users(id),
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ============================================================================
-- 12) سجل التدقيق (§14 من الوثيقة التقنية)
-- ============================================================================

create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references users(id),
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index idx_audit_entity on audit_log(entity_type, entity_id);

-- ============================================================================
-- 13) Triggers مساعدة: updated_at + إنشاء محفظة تلقائيًا
-- ============================================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on users for each row execute function set_updated_at();
create trigger trg_provider_profiles_updated_at
  before update on provider_profiles for each row execute function set_updated_at();
create trigger trg_service_requests_updated_at
  before update on service_requests for each row execute function set_updated_at();
create trigger trg_conversations_updated_at
  before update on conversations for each row execute function set_updated_at();
create trigger trg_wallets_updated_at
  before update on wallets for each row execute function set_updated_at();

create or replace function create_wallet_for_new_user() returns trigger as $$
begin
  insert into wallets(user_id, currency) values (new.id, 'SYP');
  return new;
end;
$$ language plpgsql;

create trigger trg_create_wallet_for_new_user
  after insert on users for each row execute function create_wallet_for_new_user();

-- ============================================================================
-- 14) Row Level Security — الخادم مصدر الحقيقة، ليس الواجهة (§14 التقني)
-- ============================================================================

alter table users enable row level security;
create policy users_select_own on users for select using (auth.uid() = id);
create policy users_update_own on users for update using (auth.uid() = id);

alter table provider_profiles enable row level security;
create policy provider_profiles_public_read on provider_profiles for select using (true);
create policy provider_profiles_owner_write on provider_profiles for all using (auth.uid() = user_id);

alter table skills enable row level security;
create policy skills_read on skills for select using (true);

alter table provider_skills enable row level security;
create policy provider_skills_read on provider_skills for select using (true);
create policy provider_skills_owner_write on provider_skills for all using (auth.uid() = provider_id);

alter table wallets enable row level security;
create policy wallet_owner_read on wallets for select using (auth.uid() = user_id);
-- لا سياسة insert/update للعميل: التعديل فقط عبر دوال security definer أو service_role

alter table ledger_entries enable row level security;
create policy ledger_owner_read on ledger_entries for select using (auth.uid() = user_id);

alter table service_requests enable row level security;
create policy sr_owner_all on service_requests for all using (auth.uid() = requester_id);
create policy sr_candidate_read on service_requests for select using (
  exists (select 1 from candidates c
          where c.request_id = service_requests.id and c.provider_id = auth.uid())
);

alter table candidates enable row level security;
create policy candidates_read on candidates for select using (
  auth.uid() = provider_id
  or exists (select 1 from service_requests r
             where r.id = candidates.request_id and r.requester_id = auth.uid())
);

alter table conversations enable row level security;
create policy conv_parties_select on conversations for select using (
  auth.uid() = requester_id or auth.uid() = provider_id
);
create policy conv_parties_update on conversations for update using (
  auth.uid() = requester_id or auth.uid() = provider_id
);

alter table messages enable row level security;
create policy messages_read on messages for select using (
  exists (select 1 from conversations c
          where c.id = messages.conversation_id
            and (c.requester_id = auth.uid() or c.provider_id = auth.uid()))
);
create policy messages_insert on messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.requester_id = auth.uid() or c.provider_id = auth.uid())
      and c.state in ('negotiating','agreement_pending','active')
  )
);

alter table agreements enable row level security;
create policy agreements_parties_read on agreements for select using (
  auth.uid() = requester_id or auth.uid() = provider_id
);
-- الإنشاء/التعديل فقط عبر create_agreement / approve_agreement / reject_agreement

alter table ratings enable row level security;
create policy ratings_read on ratings for select using (
  auth.uid() = from_user_id or auth.uid() = to_user_id
);
create policy ratings_insert on ratings for insert with check (auth.uid() = from_user_id);

alter table verifications enable row level security;
create policy verifications_owner_read on verifications for select using (auth.uid() = user_id);
create policy verifications_owner_insert on verifications for insert with check (auth.uid() = user_id);

alter table notifications enable row level security;
create policy notifications_owner_all on notifications for all using (auth.uid() = user_id);

alter table reports enable row level security;
create policy reports_reporter_read on reports for select using (auth.uid() = reporter_id);
create policy reports_insert on reports for insert with check (auth.uid() = reporter_id);

alter table blocks enable row level security;
create policy blocks_owner_all on blocks for all using (auth.uid() = blocker_id);

alter table app_settings enable row level security;
create policy app_settings_public_read on app_settings for select using (true);

-- audit_log: لا سياسات = لا وصول لأي عميل (authenticated/anon)، فقط service_role
alter table audit_log enable row level security;

-- ============================================================================
-- نهاية الملف
-- ============================================================================
