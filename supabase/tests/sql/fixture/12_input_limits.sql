-- FIXTURE DB ONLY. Rolled back.
-- Proves the new input limits on provider_services / service_requests (size caps + per-provider cap).
\set ON_ERROR_STOP on
begin;

insert into public.users (id, full_name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'requester'),
  ('11111111-1111-4111-8111-111111111111', 'provider');

create function pg_temp.expect_error(p_sql text, p_sqlstate text, p_label text, p_message_like text default '%') returns void language plpgsql as $f$
declare v_state text; v_msg text;
begin
  begin
    execute p_sql;
    raise exception 'TEST FAILED: % was accepted', p_label using errcode = 'P0001';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    v_state := sqlstate;
    if v_msg like 'TEST FAILED:%' then raise exception '%', v_msg; end if;
    if v_state <> p_sqlstate or v_msg not like p_message_like then
      raise exception 'TEST FAILED: % failed with % / %, expected % / %', p_label, v_state, v_msg, p_sqlstate, p_message_like;
    end if;
  end;
end
$f$;

-- accepted: normal rows
insert into public.provider_services (provider_id, description, structured_data)
values ('11111111-1111-4111-8111-111111111111', 'تدريس رياضيات', '{"service":"تدريس رياضيات","skills":["جبر"]}');
insert into public.service_requests (requester_id, raw_text, structured_data)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'أحتاج مدرس', '{"service":"تدريس رياضيات"}');

-- rejected: oversize values
select pg_temp.expect_error(
  format('insert into public.provider_services (provider_id, description) values (%L, %L)', '11111111-1111-4111-8111-111111111111', repeat('م', 1001)),
  '23514', 'description > 1000 chars', '%provider_services_description_length_chk%');
select pg_temp.expect_error(
  format('insert into public.provider_services (provider_id, description, structured_data) values (%L, %L, jsonb_build_object(''skills'', (select jsonb_agg(repeat(''م'', 200)) from generate_series(1, 400))))', '11111111-1111-4111-8111-111111111111', 'x'),
  '23514', 'provider structured_data > 32 KB', '%provider_services_structured_data_size_chk%');
select pg_temp.expect_error(
  format('insert into public.service_requests (requester_id, raw_text, structured_data) values (%L, %L, jsonb_build_object(''skills'', (select jsonb_agg(repeat(''م'', 200)) from generate_series(1, 400))))', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x'),
  '23514', 'request structured_data > 32 KB', '%service_requests_structured_data_size_chk%');

-- rejected: more than 30 services for one provider (one already exists above)
do $t$ begin
  for i in 1..29 loop
    insert into public.provider_services (provider_id, description) values ('11111111-1111-4111-8111-111111111111', 'خدمة ' || repeat('ل', i));
  end loop;
end $t$;
-- Updating an existing service must still work when the provider is already at the 30-service limit.
update public.provider_services
set description = 'تدريس رياضيات متقدم'
where provider_id = '11111111-1111-4111-8111-111111111111'
  and description = 'تدريس رياضيات';
select pg_temp.expect_error(
  format('insert into public.provider_services (provider_id, description) values (%L, %L)', '11111111-1111-4111-8111-111111111111', 'الحادية والثلاثون'),
  '23514', '31st service', 'PROVIDER_SERVICE_LIMIT_REACHED');

rollback;
\echo 'PASS fixture/12_input_limits'
