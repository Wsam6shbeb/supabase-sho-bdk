-- Minimal, privacy-safe log of exhausted Gemini rate-limit retries.
create table if not exists public.app_error_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  operation text not null check (operation in ('analyze_service_request', 'analyze_provider_service')),
  error_code text not null check (error_code = 'GEMINI_RATE_LIMITED'),
  http_status integer not null check (http_status = 429),
  attempt_count smallint not null check (attempt_count between 1 and 4),
  platform text not null check (platform in ('android', 'ios', 'web', 'windows', 'macos')),
  created_at timestamptz not null default now()
);

create index if not exists app_error_log_created_at_idx
  on public.app_error_log (created_at desc);

alter table public.app_error_log enable row level security;

revoke all on table public.app_error_log from anon, authenticated;
grant insert (operation, error_code, http_status, attempt_count, platform)
  on table public.app_error_log to authenticated;
grant select on table public.app_error_log to service_role;

drop policy if exists app_error_log_insert_own on public.app_error_log;
create policy app_error_log_insert_own
  on public.app_error_log
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

comment on table public.app_error_log is
  'Privacy-safe operational log for Gemini rate-limit failures after automatic retries are exhausted.';
