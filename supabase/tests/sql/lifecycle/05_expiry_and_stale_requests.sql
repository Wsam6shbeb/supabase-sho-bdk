-- Run AFTER 00_fixture.sql and migration 20261107130000 on a scratch database.
\set ON_ERROR_STOP on
begin;
\o /dev/null
create temp table _t(name text, ok boolean);
create function pg_temp.check(p_name text, p_ok boolean) returns void language sql as
  $$ insert into _t values (p_name, coalesce(p_ok, false)) $$;

insert into public.users(id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1','customer'),
  ('00000000-0000-0000-0000-0000000000a2','provider1'),
  ('00000000-0000-0000-0000-0000000000a3','provider2'),
  ('00000000-0000-0000-0000-0000000000b1','other-customer');

-- نعطّل trigger الإغلاق أثناء تجهيز البيانات فقط، حتى لا يغلق طلبات تجريبية سابقة لنفس الزبون.
alter table public.service_requests disable trigger trg_retire_stale_requests;

-- ============ A) انتهاء مهلة الاتفاقات ============
insert into public.service_requests(id, requester_id, raw_text, state) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','req A','agreement_pending_provider');
insert into public.conversations(id, request_id, requester_id, provider_id, state) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','agreement_pending'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a3','locked_temp');
insert into public.agreements(id, request_id, conversation_id, requester_id, provider_id, state, expires_at) values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','pending', now() - interval '5 minutes');
-- اتفاق لم تنتهِ مهلته بعد (طلب آخر) يجب ألا يُمَس
insert into public.service_requests(id, requester_id, raw_text, state) values
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b1','req B','agreement_pending_provider');
insert into public.conversations(id, request_id, requester_id, provider_id, state) values
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a2','agreement_pending');
insert into public.agreements(id, request_id, conversation_id, requester_id, provider_id, state, expires_at) values
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a2','pending', now() + interval '10 minutes');

select pg_temp.check('expire returns 1', public.expire_pending_agreements() = 1);
select pg_temp.check('expired agreement marked expired + responded_at',
  (select state = 'expired' and responded_at is not null from public.agreements where id = '30000000-0000-0000-0000-000000000001'));
select pg_temp.check('request back to negotiating',
  (select state = 'negotiating' from public.service_requests where id = '10000000-0000-0000-0000-000000000001'));
select pg_temp.check('both conversations back to negotiating',
  (select count(*) = 2 from public.conversations where request_id = '10000000-0000-0000-0000-000000000001' and state = 'negotiating' and locked_reason is null));
select pg_temp.check('one system message posted',
  (select count(*) = 1 from public.messages where conversation_id = '20000000-0000-0000-0000-000000000001' and message_type = 'system'));
select pg_temp.check('both sides notified', (select count(*) = 2 from public.notifications_log));
select pg_temp.check('unexpired agreement untouched',
  (select state = 'pending' from public.agreements where id = '30000000-0000-0000-0000-000000000002'));
select pg_temp.check('second run is a no-op', public.expire_pending_agreements() = 0);
select pg_temp.check('expire fn not executable by authenticated', not has_function_privilege('authenticated', 'public.expire_pending_agreements()', 'execute'));
select pg_temp.check('expire fn not executable by anon', not has_function_privilege('anon', 'public.expire_pending_agreements()', 'execute'));

-- ============ B) إغلاق الطلبات القديمة عند طلب جديد ============
insert into public.service_requests(id, requester_id, raw_text, state) values
  ('10000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-0000000000a1','old negotiating','negotiating'),
  ('10000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a1','old active','active'),
  ('10000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-0000000000a1','old pending agreement','agreement_pending_provider'),
  ('10000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-0000000000a1','old completed','completed'),
  ('10000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-0000000000b1','other customer submitted','submitted');
insert into public.conversations(id, request_id, requester_id, provider_id, state) values
  ('20000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','negotiating'),
  ('20000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','active'),
  ('20000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','agreement_pending'),
  ('20000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a3','negotiating');
insert into public.agreements(request_id, conversation_id, requester_id, provider_id, state, expires_at) values
  ('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','active', now()),
  ('10000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','pending', now() + interval '10 minutes');

alter table public.service_requests enable trigger trg_retire_stale_requests;

-- الزبون ينشئ طلباً جديداً بصلاحية authenticated (كما يفعل التطبيق)
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into public.service_requests(id, requester_id, raw_text) values
  ('10000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-0000000000a1','brand new request');
reset role;

select pg_temp.check('new request created as submitted',
  (select state = 'submitted' from public.service_requests where id = '10000000-0000-0000-0000-000000000099'));
select pg_temp.check('old pre-agreement request cancelled',
  (select state = 'cancelled' and cancelled_at is not null from public.service_requests where id = '10000000-0000-0000-0000-000000000010'));
select pg_temp.check('old negotiating conversation closed (read_only)',
  (select state = 'read_only' from public.conversations where id = '20000000-0000-0000-0000-000000000010'));
select pg_temp.check('closure message posted to the old conversation',
  (select count(*) = 1 from public.messages where conversation_id = '20000000-0000-0000-0000-000000000010' and message_type = 'system'));
select pg_temp.check('active request NOT touched',
  (select state = 'active' from public.service_requests where id = '10000000-0000-0000-0000-000000000011')
  and (select state = 'active' from public.conversations where id = '20000000-0000-0000-0000-000000000011'));
select pg_temp.check('pending-agreement request NOT touched',
  (select state = 'agreement_pending_provider' from public.service_requests where id = '10000000-0000-0000-0000-000000000012')
  and (select state = 'agreement_pending' from public.conversations where id = '20000000-0000-0000-0000-000000000012'));
select pg_temp.check('completed request NOT touched',
  (select state = 'completed' from public.service_requests where id = '10000000-0000-0000-0000-000000000013'));
select pg_temp.check('other customer request NOT touched',
  (select state = 'submitted' from public.service_requests where id = '10000000-0000-0000-0000-000000000014')
  and (select state = 'negotiating' from public.conversations where id = '20000000-0000-0000-0000-000000000014'));

-- فشل داخل الـtrigger يجب ألا يمنع إنشاء الطلب
alter table public.service_requests disable trigger trg_retire_stale_requests;
alter table public.messages add constraint _force_fail check (body <> 'تم إغلاق هذه المحادثة لأن الزبون بدأ طلباً جديداً.') not valid;
insert into public.service_requests(id, requester_id, raw_text, state) values
  ('10000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-0000000000b1','still negotiating again','negotiating');
insert into public.conversations(id, request_id, requester_id, provider_id, state) values
  ('20000000-0000-0000-0000-000000000020','10000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a2','negotiating');
alter table public.service_requests enable trigger trg_retire_stale_requests;
insert into public.service_requests(id, requester_id, raw_text) values
  ('10000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-0000000000b1','request despite trigger failure');
select pg_temp.check('trigger failure does not block request creation',
  exists (select 1 from public.service_requests where id = '10000000-0000-0000-0000-000000000021'));
select pg_temp.check('failed retirement rolled back as a whole (no half state)',
  (select state = 'negotiating' from public.service_requests where id = '10000000-0000-0000-0000-000000000020')
  and (select state = 'negotiating' from public.conversations where id = '20000000-0000-0000-0000-000000000020'));
select pg_temp.check('retire fn not executable by authenticated', not has_function_privilege('authenticated', 'private.retire_stale_requests_on_new_request()', 'execute'));

\o
do $$
declare bad text;
begin
  select string_agg(name, '; ') into bad from _t where not ok;
  if bad is not null then raise exception 'FAILED CHECKS: %', bad; end if;
  raise notice 'ALL % CHECKS PASSED', (select count(*) from _t);
end
$$;
rollback;
