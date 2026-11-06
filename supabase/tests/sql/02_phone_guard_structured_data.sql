-- Proves: the phone-number guard now covers the free-text paths inside structured_data for
-- provider_services and service_requests, without blocking normal Arabic data or old rows.
-- It re-attaches the *real* trigger argument lists (read from pg_trigger) to temp tables, so it
-- tests the production configuration without needing any rows. Safe on any database. Rolled back.
\set ON_ERROR_STOP on
begin;

create temp table _ps (description text, structured_data jsonb) on commit drop;
create temp table _sr (raw_text text, additional_info text, service_area text, region text, structured_data jsonb) on commit drop;

do $t$
declare ps_args text; sr_args text;
begin
  select substring(pg_get_triggerdef(t.oid) from 'reject_phone_numbers_in_text_columns\((.*)\)\s*$') into ps_args
  from pg_trigger t where t.tgrelid = 'public.provider_services'::regclass and t.tgname = 'reject_phone_numbers_provider_services';
  select substring(pg_get_triggerdef(t.oid) from 'reject_phone_numbers_in_text_columns\((.*)\)\s*$') into sr_args
  from pg_trigger t where t.tgrelid = 'public.service_requests'::regclass and t.tgname = 'reject_phone_numbers_service_requests';
  assert ps_args is not null, 'provider_services phone trigger not found';
  assert sr_args is not null, 'service_requests phone trigger not found';
  execute format('create trigger t_ps before insert or update on pg_temp._ps for each row execute function public.reject_phone_numbers_in_text_columns(%s)', ps_args);
  execute format('create trigger t_sr before insert or update on pg_temp._sr for each row execute function public.reject_phone_numbers_in_text_columns(%s)', sr_args);
end
$t$;

create function pg_temp.expect_phone_rejected(p_sql text, p_label text) returns void language plpgsql as $f$
begin
  begin
    execute p_sql;
    raise exception 'TEST FAILED: % was accepted', p_label;
  exception when check_violation then
    if sqlerrm <> 'PHONE_NUMBER_NOT_ALLOWED' then
      raise exception 'TEST FAILED: % rejected for another reason: %', p_label, sqlerrm;
    end if;
  end;
end
$f$;

do $t$
declare
  path text;
  phone constant text := 'اتصل بي 0933123456';
  words constant text := 'صفر تسعة ثلاثة ثلاثة واحد اثنين ثلاثة اربعة خمسة ستة';
begin
  -- provider_services: scalar paths
  foreach path in array array['service','category','location','region','city','area','service_area','delivery_mode','additional_info'] loop
    perform pg_temp.expect_phone_rejected(
      format('insert into pg_temp._ps values (%L, jsonb_build_object(%L, %L))', 'x', path, phone), 'provider_services.structured_data.' || path);
  end loop;
  -- provider_services: arrays, nested object, and spelled-out digits
  perform pg_temp.expect_phone_rejected(format('insert into pg_temp._ps values (%L, %L::jsonb)', 'x', jsonb_build_object('skills', jsonb_build_array('جبر', phone))::text), 'provider_services.skills[1]');
  perform pg_temp.expect_phone_rejected(format('insert into pg_temp._ps values (%L, %L::jsonb)', 'x', jsonb_build_object('synonyms', jsonb_build_array(phone))::text), 'provider_services.synonyms');
  perform pg_temp.expect_phone_rejected(format('insert into pg_temp._ps values (%L, %L::jsonb)', 'x', jsonb_build_object('service_area', jsonb_build_object('city','اللاذقية','areas', jsonb_build_array(phone)))::text), 'provider_services.service_area.areas');
  perform pg_temp.expect_phone_rejected(format('insert into pg_temp._ps values (%L, %L::jsonb)', 'x', jsonb_build_object('skills', jsonb_build_array(words))::text), 'provider_services.skills (digits as words)');

  -- service_requests
  foreach path in array array['service','category','location','region','city','area','service_area','delivery_mode','additional_info'] loop
    perform pg_temp.expect_phone_rejected(
      format('insert into pg_temp._sr values (%L, null, null, null, jsonb_build_object(%L, %L))', 'x', path, phone), 'service_requests.structured_data.' || path);
  end loop;
  perform pg_temp.expect_phone_rejected(format('insert into pg_temp._sr values (%L, null, null, null, %L::jsonb)', 'x', jsonb_build_object('skills', jsonb_build_array(phone))::text), 'service_requests.skills');
  perform pg_temp.expect_phone_rejected(format('insert into pg_temp._sr values (%L, null, null, null, %L::jsonb)', 'x', jsonb_build_object('synonyms', jsonb_build_array(words))::text), 'service_requests.synonyms (digits as words)');
  perform pg_temp.expect_phone_rejected(format('insert into pg_temp._sr values (%L, null, null, null, %L::jsonb)', 'x', jsonb_build_object('service_area', jsonb_build_object('areas', jsonb_build_array(phone)))::text), 'service_requests.service_area.areas');
  -- pre-existing guards keep working
  perform pg_temp.expect_phone_rejected(format('insert into pg_temp._ps values (%L, null)', phone), 'provider_services.description');
  perform pg_temp.expect_phone_rejected(format('insert into pg_temp._sr values (%L, null, null, null, null)', phone), 'service_requests.raw_text');
end
$t$;

-- Normal Arabic AI-style data must still be accepted (no false positives).
insert into pg_temp._ps values (
  'تدريس رياضيات للصف التاسع',
  '{"service":"تدريس رياضيات للصف التاسع","category":"تعليم","skills":["جبر","هندسة","تحضير للامتحانات"],
    "synonyms":["مدرس خصوصي","دروس رياضيات"],"location":"شارع 5 بناء 12 الطابق 3","region":"اللاذقية","city":"اللاذقية",
    "service_area":{"type":"city","city":"اللاذقية","areas":["الزراعة","الصليبة"],"raw":"كل اللاذقية"},
    "delivery_mode":"حضوري","additional_info":"خبرة 5 سنوات مع طلاب الصف 9 و10 و11"}');
insert into pg_temp._sr values (
  'أحتاج مدرس رياضيات', null, 'الزراعة', 'اللاذقية',
  '{"service":"تدريس رياضيات","category":"تعليم","skills":["جبر"],"synonyms":["مدرس خصوصي"],"location":"الزراعة",
    "service_area":{"type":"area","city":"اللاذقية","areas":["الزراعة"]},"additional_info":"للصف التاسع"}');

-- Old rows are not retro-checked: an unchanged value passes when another column is updated.
alter table pg_temp._ps disable trigger t_ps;
insert into pg_temp._ps values ('legacy row', jsonb_build_object('skills', jsonb_build_array('اتصل 0933123456')));
alter table pg_temp._ps enable trigger t_ps;
update pg_temp._ps set description = 'legacy row edited' where description = 'legacy row';

rollback;
\echo 'PASS 02_phone_guard_structured_data'
