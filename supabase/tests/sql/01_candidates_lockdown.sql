-- Proves: clients can no longer write public.candidates; readers and the service role still work.
-- Safe on any database (introspection + statements that fail before touching data). Rolled back.
\set ON_ERROR_STOP on
begin;

do $t$
begin
  assert not has_table_privilege('authenticated', 'public.candidates', 'INSERT'), 'authenticated can still INSERT into candidates';
  assert not has_table_privilege('authenticated', 'public.candidates', 'UPDATE'), 'authenticated can still UPDATE candidates';
  assert not has_table_privilege('authenticated', 'public.candidates', 'DELETE'), 'authenticated can DELETE candidates';
  assert not has_table_privilege('anon', 'public.candidates', 'INSERT'), 'anon can INSERT into candidates';
  assert not has_table_privilege('anon', 'public.candidates', 'UPDATE'), 'anon can UPDATE candidates';
  assert has_table_privilege('authenticated', 'public.candidates', 'SELECT'), 'authenticated lost SELECT on candidates';
  assert has_table_privilege('service_role', 'public.candidates', 'INSERT'), 'service_role lost INSERT on candidates';
  assert has_table_privilege('service_role', 'public.candidates', 'UPDATE'), 'service_role lost UPDATE on candidates';

  assert not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidates'
      and cmd in ('INSERT', 'UPDATE', 'ALL') and policyname <> 'active_account_required'
  ), 'a client write policy still exists on candidates';
  assert exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'candidates' and policyname = 'candidates_read'),
    'candidates_read policy is missing';
  assert exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidates' and policyname = 'active_account_required' and permissive = 'RESTRICTIVE'
  ), 'restrictive active_account_required policy is missing';
end
$t$;

-- Behavioural check: the failure must be a *privilege* error, not merely an RLS rejection.
set local role authenticated;
do $t$
declare v_msg text;
begin
  begin
    insert into public.candidates (request_id, provider_id, rank, match_score)
    values (gen_random_uuid(), gen_random_uuid(), 1, 100);
    raise exception 'TEST FAILED: authenticated INSERT into candidates was accepted';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like 'permission denied for table candidates%' then
      raise exception 'TEST FAILED: INSERT was blocked by something other than the privilege check: %', v_msg;
    end if;
  end;

  begin
    update public.candidates set rank = 1 where false;
    raise exception 'TEST FAILED: authenticated UPDATE on candidates was accepted';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like 'permission denied for table candidates%' then
      raise exception 'TEST FAILED: UPDATE was blocked by something other than the privilege check: %', v_msg;
    end if;
  end;
end
$t$;
reset role;

rollback;
\echo 'PASS 01_candidates_lockdown'
