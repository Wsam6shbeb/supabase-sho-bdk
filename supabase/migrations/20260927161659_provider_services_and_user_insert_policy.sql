-- ============================================================================
-- إضافات لاحقة على المخطط الأساسي (20260926211313_initial_schema.sql)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) سياسة إدراج ناقصة بجدول users
-- ----------------------------------------------------------------------------
-- المخطط الأساسي فعّل RLS على users وأضاف سياستي select/update فقط
-- (users_select_own, users_update_own) بدون سياسة insert، ما يعني
-- إنو أي مستخدم جديد يسجّل حساب (auth.signUp) ما فيه ينشئ صف بجدول
-- users من الواجهة أبداً — وبالتالي ما بينفّذ trigger إنشاء المحفظة
-- (trg_create_wallet_for_new_user) لأنو هاد التريغر مرتبط بـ INSERT على
-- users مباشرة وليس على auth.users.
create policy users_insert_own on users for insert with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2) جدول خدمات مقدّم الخدمة (كان هدفه الأصلي جدول Django منفصل)
-- ----------------------------------------------------------------------------
create table provider_services (
  id                 uuid primary key default gen_random_uuid(),
  provider_id        uuid not null references provider_profiles(user_id) on delete cascade,
  skill_id           uuid references skills(id),
  description        text not null,
  experience_years   integer not null default 0 check (experience_years >= 0),
  price_min          numeric(12,2) not null default 0 check (price_min >= 0),
  price_max          numeric(12,2) not null default 0 check (price_max >= price_min),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_provider_services_provider on provider_services(provider_id);

create trigger trg_provider_services_updated_at
  before update on provider_services for each row execute function set_updated_at();

alter table provider_services enable row level security;

-- القراءة عامة (نفس منطق provider_profiles_public_read) لأنها تُعرض
-- بصفحة المزوّد العامة للعملاء المحتملين.
create policy provider_services_public_read on provider_services for select using (true);

-- الكتابة (إضافة/تعديل/حذف) لصاحب الملف فقط.
create policy provider_services_owner_write on provider_services for all
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);
