-- Run AFTER 00_fixture.sql and migration 20261108120000 on a scratch database.
\set ON_ERROR_STOP on
begin;
\o /dev/null
create temp table _t(name text, ok boolean);
create function pg_temp.check(p_name text, p_ok boolean) returns void language sql as
  $$ insert into _t values (p_name, coalesce(p_ok, false)) $$;

insert into public.app_settings(key, value) values ('commission_max', '50'::jsonb);

insert into public.users(id, full_name, status, deleted_at, rating_avg, rating_count) values
  ('00000000-0000-0000-0000-0000000000c1','viewer','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000c2','alice','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000c3','bob','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000c4','suspended','suspended',null,null,0),
  ('00000000-0000-0000-0000-0000000000c5','deleted','active', now(),null,0),
  ('00000000-0000-0000-0000-0000000000c6','blocked-by-viewer','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000c7','blocks-viewer','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000c8','inactive-viewer','suspended',null,null,0),
  -- providers
  ('00000000-0000-0000-0000-0000000000d1','prov-ok','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000d2','prov-unavailable','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000d3','prov-low-balance','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000d4','prov-no-wallet','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000d5','prov-suspended','suspended',null,null,0),
  ('00000000-0000-0000-0000-0000000000d6','prov-deleted','active', now(),null,0),
  ('00000000-0000-0000-0000-0000000000d7','prov-low-rated','active',null,2.9,5),
  ('00000000-0000-0000-0000-0000000000d8','prov-few-bad-ratings','active',null,2.0,4),
  ('00000000-0000-0000-0000-0000000000d9','prov-blocked-by-viewer','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000da','prov-blocks-viewer','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000db','prov-dup-service','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000dc','prov-many-services','active',null,null,0),
  ('00000000-0000-0000-0000-0000000000dd','prov-unsafe-text','active',null,null,0);
insert into public.blocks(blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c6'),
  ('00000000-0000-0000-0000-0000000000c7','00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d9'),
  ('00000000-0000-0000-0000-0000000000da','00000000-0000-0000-0000-0000000000c1');

insert into public.provider_profiles(user_id, is_available)
  select id, (id <> '00000000-0000-0000-0000-0000000000d2') from public.users where full_name like 'prov-%';
insert into public.wallets(user_id, available_balance)
  select id, case when id = '00000000-0000-0000-0000-0000000000d3' then 49 else 100 end
    from public.users where full_name like 'prov-%' and id <> '00000000-0000-0000-0000-0000000000d4';

insert into public.provider_services(provider_id, is_active, description, structured_data, created_at) values
  ('00000000-0000-0000-0000-0000000000d1', true,  'وصف حر لا يجب أن يظهر 0944123456', '{"service":"تعقيب معاملات"}', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000d1', false, 'خدمة معطّلة',                      '{"service":"خدمة معطلة"}',    now() - interval '2 minutes'),
  ('00000000-0000-0000-0000-0000000000d2', true,  null,                               '{"service":"مزود غير متاح"}', now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-0000000000d3', true,  null,                               '{"service":"رصيد قليل"}',     now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-0000000000d4', true,  null,                               '{"service":"بدون محفظة"}',    now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-0000000000d5', true,  null,                               '{"service":"مزود موقوف"}',    now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-0000000000d6', true,  null,                               '{"service":"مزود محذوف"}',    now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-0000000000d7', true,  null,                               '{"service":"تقييم منخفض"}',   now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-0000000000d8', true,  null,                               '{"service":"تقييم قليل العدد"}', now() - interval '4 minutes'),
  ('00000000-0000-0000-0000-0000000000d9', true,  null,                               '{"service":"مزود حظرته"}',    now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-0000000000da', true,  null,                               '{"service":"مزود حظرني"}',    now() - interval '3 minutes'),
  -- same text from two providers -> once
  ('00000000-0000-0000-0000-0000000000db', true,  null,                               '{"service":"سيارة أجرة"}',    now() - interval '5 minutes'),
  ('00000000-0000-0000-0000-0000000000d1', true,  null,                               '{"service":"سيارة أجرة"}',    now() - interval '6 minutes'),
  -- no structured service (description only) -> excluded
  ('00000000-0000-0000-0000-0000000000db', true,  'وصف فقط',                          '{}',                          now() - interval '7 minutes'),
  -- 4 services for one provider -> 3 max
  ('00000000-0000-0000-0000-0000000000dc', true,  null, '{"service":"خدمة م1"}', now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-0000000000dc', true,  null, '{"service":"خدمة م2"}', now() - interval '21 minutes'),
  ('00000000-0000-0000-0000-0000000000dc', true,  null, '{"service":"خدمة م3"}', now() - interval '22 minutes'),
  ('00000000-0000-0000-0000-0000000000dc', true,  null, '{"service":"خدمة م4"}', now() - interval '23 minutes'),
  -- unsafe text -> excluded
  ('00000000-0000-0000-0000-0000000000dd', true,  null, '{"service":"اتصل 0944123456"}',       now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-0000000000dd', true,  null, '{"service":"كلمني واتساب"}',           now() - interval '31 minutes'),
  ('00000000-0000-0000-0000-0000000000dd', true,  null, '{"service":"https://example.com"}',    now() - interval '32 minutes'),
  ('00000000-0000-0000-0000-0000000000dd', true,  null, '{"service":"a@b.com"}',                now() - interval '33 minutes'),
  ('00000000-0000-0000-0000-0000000000dd', true,  null, '{"service":"ا"}',                       now() - interval '34 minutes'),
  -- long text -> truncated at 80
  ('00000000-0000-0000-0000-0000000000dd', true,  null, jsonb_build_object('service', repeat('ج', 300)), now() - interval '35 minutes');

alter table public.service_requests disable trigger trg_retire_stale_requests;
insert into public.service_requests(requester_id, raw_text, state, created_at) values
  ('00000000-0000-0000-0000-0000000000c2','بدي معلم صحية',                       'submitted',  now() - interval '90 seconds'),
  ('00000000-0000-0000-0000-0000000000c2','احتاج سباك',                          'cancelled',  now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000000c2','بدي نجار',                            'completed',  now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000c2','بدي كهربائي',                         'submitted',  now() - interval '4 hours'),
  ('00000000-0000-0000-0000-0000000000c3','رسم',                                 'submitted',  now() - interval '10 minutes'),
  ('00000000-0000-0000-0000-0000000000c3','رسم',                                 'submitted',  now() - interval '15 minutes'),
  ('00000000-0000-0000-0000-0000000000c3', E'الو\nتوضيح المستخدم: بدي حدا يعلمني الألمانية', 'submitted', now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-0000000000c3','كلمني على 0944123456',                'submitted',  now() - interval '41 minutes'),
  ('00000000-0000-0000-0000-0000000000c3','كلمني على ٠٩٤٤١٢٣٤٥٦',              'submitted',  now() - interval '42 minutes'),
  ('00000000-0000-0000-0000-0000000000c3','شوف https://example.com',            'submitted',  now() - interval '43 minutes'),
  ('00000000-0000-0000-0000-0000000000c3','راسلني a@b.com',                     'submitted',  now() - interval '44 minutes'),
  ('00000000-0000-0000-0000-0000000000c3','تواصل معي على واتساب',               'submitted',  now() - interval '45 minutes'),
  ('00000000-0000-0000-0000-0000000000c3','ا',                                   'submitted',  now() - interval '46 minutes'),
  ('00000000-0000-0000-0000-0000000000c4','من موقوف',                            'submitted',  now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000c5','من محذوف',                            'submitted',  now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000c6','من محظور عندي',                       'submitted',  now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000c7','من حاظري',                            'submitted',  now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000c2','مسودة',                               'draft',      now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000c3','قديم جداً',                           'submitted',  now() - interval '31 days'),
  ('00000000-0000-0000-0000-0000000000c3', repeat('ب', 300),                     'submitted',  now() - interval '50 minutes');
alter table public.service_requests enable trigger trg_retire_stale_requests;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
create temp table _f as select row_number() over () as pos, kind, body from public.get_home_feed(20);
reset role;
grant select on _f to public;

-- ===== الترتيب والاختلاط =====
select pg_temp.check('newest first: the 1-minute offer is first', (select kind = 'offer' and body = 'تعقيب معاملات' from _f where pos = 1));
select pg_temp.check('90-second request is second', (select kind = 'request' and body = 'بدي معلم صحية' from _f where pos = 2));
select pg_temp.check('feed mixes requests and offers', exists (select 1 from _f where kind='request') and exists (select 1 from _f where kind='offer'));

-- ===== العروض =====
select pg_temp.check('offer text comes from the structured service name, not the free description',
  not exists (select 1 from _f where body like '%وصف%'));
select pg_temp.check('inactive service excluded', not exists (select 1 from _f where body = 'خدمة معطلة'));
select pg_temp.check('unavailable provider excluded', not exists (select 1 from _f where body = 'مزود غير متاح'));
select pg_temp.check('balance below commission_max excluded', not exists (select 1 from _f where body = 'رصيد قليل'));
select pg_temp.check('provider without wallet excluded', not exists (select 1 from _f where body = 'بدون محفظة'));
select pg_temp.check('suspended provider excluded', not exists (select 1 from _f where body = 'مزود موقوف'));
select pg_temp.check('deleted provider excluded', not exists (select 1 from _f where body = 'مزود محذوف'));
select pg_temp.check('low-rated provider (5 ratings, avg 2.9) hidden like in matching', not exists (select 1 from _f where body = 'تقييم منخفض'));
select pg_temp.check('provider with few bad ratings (4) still shown like in matching', exists (select 1 from _f where body = 'تقييم قليل العدد'));
select pg_temp.check('provider I blocked excluded', not exists (select 1 from _f where body = 'مزود حظرته'));
select pg_temp.check('provider who blocked me excluded', not exists (select 1 from _f where body = 'مزود حظرني'));
select pg_temp.check('same service text from two providers appears once', (select count(*) = 1 from _f where kind='offer' and body = 'سيارة أجرة'));
select pg_temp.check('service without structured name excluded', not exists (select 1 from _f where body = 'وصف فقط'));
select pg_temp.check('at most 3 offers per provider', (select count(*) = 3 from _f where kind='offer' and body like 'خدمة م_'));
select pg_temp.check('offer with phone excluded', not exists (select 1 from _f where body like '%0944123456%' and kind = 'offer'));
select pg_temp.check('offer mentioning a messaging app excluded', not exists (select 1 from _f where body like '%واتساب%' and kind = 'offer'));
select pg_temp.check('offer link excluded', not exists (select 1 from _f where body like '%example.com%' and kind = 'offer'));
select pg_temp.check('offer email excluded', not exists (select 1 from _f where body like '%a@b.com%' and kind = 'offer'));
select pg_temp.check('too-short offer excluded', not exists (select 1 from _f where kind='offer' and body = 'ا'));
select pg_temp.check('long offer truncated to 80', exists (select 1 from _f where kind='offer' and char_length(body) = 80));

-- ===== الطلبات =====
select pg_temp.check('duplicate request text from same person appears once', (select count(*) = 1 from _f where kind='request' and body = 'رسم'));
select pg_temp.check('clarification text used instead of the first line',
  exists (select 1 from _f where body = 'بدي حدا يعلمني الألمانية') and not exists (select 1 from _f where body = 'الو'));
select pg_temp.check('cancelled and completed requests are included',
  exists (select 1 from _f where body = 'احتاج سباك') and exists (select 1 from _f where body = 'بدي نجار'));
select pg_temp.check('at most 3 requests per person (alice: 4th dropped)', not exists (select 1 from _f where body = 'بدي كهربائي'));
select pg_temp.check('latin phone in request excluded', not exists (select 1 from _f where kind='request' and body like '%0944123456%'));
select pg_temp.check('arabic-indic phone in request excluded', not exists (select 1 from _f where kind='request' and body like '%٠٩٤٤١٢٣٤٥٦%'));
select pg_temp.check('url in request excluded', not exists (select 1 from _f where kind='request' and body like '%example.com%'));
select pg_temp.check('email in request excluded', not exists (select 1 from _f where kind='request' and body like '%a@b.com%'));
select pg_temp.check('messaging app in request excluded', not exists (select 1 from _f where kind='request' and body like '%واتساب%'));
select pg_temp.check('too-short request excluded', not exists (select 1 from _f where kind='request' and body = 'ا'));
select pg_temp.check('suspended requester excluded', not exists (select 1 from _f where body = 'من موقوف'));
select pg_temp.check('deleted requester excluded', not exists (select 1 from _f where body = 'من محذوف'));
select pg_temp.check('requester I blocked excluded', not exists (select 1 from _f where body = 'من محظور عندي'));
select pg_temp.check('requester who blocked me excluded', not exists (select 1 from _f where body = 'من حاظري'));
select pg_temp.check('draft excluded', not exists (select 1 from _f where body = 'مسودة'));
select pg_temp.check('request older than 30 days excluded', not exists (select 1 from _f where body = 'قديم جداً'));
select pg_temp.check('long request truncated to 120', exists (select 1 from _f where kind='request' and char_length(body) = 120));

-- ===== الحدود والصلاحيات =====
select pg_temp.check('never more than 20 rows', (select count(*) <= 20 from _f));
-- بيانات إضافية لاختبار سقف 20: 30 زبوناً بطلب لكل منهم
insert into public.users(id, full_name) select ('00000000-0000-0000-0000-00000000' || lpad(i::text, 4, '0'))::uuid, 'bulk' || i from generate_series(1000, 1029) i;
alter table public.service_requests disable trigger trg_retire_stale_requests;
insert into public.service_requests(requester_id, raw_text, state, created_at)
  select ('00000000-0000-0000-0000-00000000' || lpad(i::text, 4, '0'))::uuid, 'طلب عام ' || chr(1632 + (i % 10)) || ' ' || i, 'submitted', now() - make_interval(secs => i)
  from generate_series(1000, 1029) i;
alter table public.service_requests enable trigger trg_retire_stale_requests;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
create temp table _f5 as select kind, body from public.get_home_feed(5);
create temp table _f99 as select kind, body from public.get_home_feed(99);
reset role;
grant select on _f5, _f99 to public;
select pg_temp.check('p_limit = 5 returns 5', (select count(*) = 5 from _f5));
select pg_temp.check('p_limit above 20 is capped at 20', (select count(*) = 20 from _f99));

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c8';
create temp table _fi as select kind, body from public.get_home_feed(20);
reset role;
grant select on _fi to public;
select pg_temp.check('inactive caller gets nothing', (select count(*) = 0 from _fi));

select pg_temp.check('anon cannot execute', not has_function_privilege('anon', 'public.get_home_feed(integer)', 'execute'));
select pg_temp.check('authenticated can execute', has_function_privilege('authenticated', 'public.get_home_feed(integer)', 'execute'));

-- ===== تغيير إعداد العمولة يغيّر الأهلية (نفس سلوك المطابقة) =====
update public.app_settings set value = '30'::jsonb where key = 'commission_max';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
create temp table _fs as select kind, body from public.get_home_feed(20);
reset role;
grant select on _fs to public;
select pg_temp.check('lower commission_max makes the 49-balance provider eligible', exists (select 1 from _fs where body = 'رصيد قليل'));

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
