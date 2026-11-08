-- LOCAL/CI SCRATCH POSTGRES ONLY. Never run this against the Supabase project.
-- Minimal re-creation of the tables/enums/functions that migration 20261107130000 touches.
-- _post_system_message is the verbatim production body; notify_on_agreement_change is reduced
-- to its 'expired' branch (it writes to a local notifications table instead of public._notify).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$$;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create type public.request_state as enum ('draft','submitted','clarification','matching','candidates_ready','negotiating','agreement_pending_provider','active','completion_pending_rating','completed','cancelled','expired');
create type public.conversation_state as enum ('negotiating','agreement_pending','active','locked_temp','read_only');
create type public.agreement_state as enum ('pending','active','rejected','expired','cancelled');

create table public.users (id uuid primary key, full_name text);
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id),
  raw_text text,
  state public.request_state not null default 'submitted',
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id),
  requester_id uuid not null references public.users(id),
  provider_id uuid not null references public.users(id),
  state public.conversation_state not null default 'negotiating',
  locked_reason text,
  writable_until timestamptz,
  unique (request_id, provider_id)
);
create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id),
  conversation_id uuid not null references public.conversations(id),
  requester_id uuid not null references public.users(id),
  provider_id uuid not null references public.users(id),
  state public.agreement_state not null default 'pending',
  expires_at timestamptz not null,
  responded_at timestamptz
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id),
  sender_id uuid not null references public.users(id),
  body text not null,
  message_type text not null default 'text'
);
create table public.notifications_log (id bigserial primary key, user_id uuid, title text);

create or replace function public._post_system_message(p_conversation_id uuid, p_sender uuid, p_body text)
 returns void language sql security definer set search_path to 'public', 'pg_temp'
as $function$
  insert into public.messages (conversation_id, sender_id, body, message_type)
  values (p_conversation_id, p_sender, p_body, 'system');
$function$;

create or replace function public.notify_on_agreement_change() returns trigger
 language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'UPDATE' and old.state = 'pending' and new.state = 'expired' then
    insert into public.notifications_log (user_id, title) values (new.requester_id, 'انتهت مهلة الموافقة');
    insert into public.notifications_log (user_id, title) values (new.provider_id, 'انتهت مهلة الموافقة');
  end if;
  return new;
end;
$function$;
create trigger agreements_notify_trg after update of state on public.agreements
  for each row execute function public.notify_on_agreement_change();

create or replace function public.force_initial_request_state() returns trigger
 language plpgsql set search_path to 'public'
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    new.state := 'submitted'; new.cancelled_at := null;
  end if;
  return new;
end;
$function$;
create trigger trg_force_initial_request_state before insert on public.service_requests
  for each row execute function public.force_initial_request_state();

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.service_requests to authenticated;
grant select on public.conversations, public.agreements, public.messages, public.users to authenticated;
grant all on all tables in schema public to service_role;
