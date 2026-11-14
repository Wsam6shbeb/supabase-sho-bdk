\set ON_ERROR_STOP on
begin;

do $test$
begin
  assert public.contains_phone_number('صفر تسعة اربعة اربعة خمسة تلاتة واحد 345'), 'spoken digits mixed with group';
  assert public.contains_phone_number('0 9 4 4 5 3 1 345'), 'split prefix';
  assert public.contains_phone_number('0 9 44 531 345'), 'mixed groups';
  assert public.contains_phone_number('+ 9 6 3 9 4 4 5 3 1 3 4 5'), 'split country code';
  assert public.contains_phone_number('00963933123456'), 'international 00 prefix';
  assert public.contains_phone_number(E'09\u200B44\u200B531\u200B345'), 'zero width';
  assert not public.contains_phone_number('السعر 1 500 000 ليرة'), 'formatted price';
  assert not public.contains_phone_number('شارع 5 بناء 12 الطابق 3'), 'address';
  assert not public.contains_phone_number('3 غرف و2 حمام 120 متر'), 'property details';
  assert not public.contains_phone_number('مبلغ 1 000 000 000'), 'large formatted amount';
end
$test$;

-- Exercise the actual BEFORE INSERT chat trigger without touching messages.
create temp table _phone_guard_chat_test (
  body text,
  message_type text
) on commit drop;

create trigger _phone_guard_chat_test_trg
before insert on _phone_guard_chat_test
for each row execute function public.reject_phone_numbers_in_chat_message();

create function pg_temp.expect_chat_phone_rejected(p_body text)
returns void language plpgsql as $f$
begin
  begin
    insert into pg_temp._phone_guard_chat_test(body, message_type)
    values (p_body, 'text');
    raise exception 'TEST FAILED: chat accepted mixed phone text';
  exception when check_violation then
    if sqlerrm <> 'PHONE_NUMBER_NOT_ALLOWED' then
      raise exception 'TEST FAILED: chat rejected for another reason: %', sqlerrm;
    end if;
  end;
end
$f$;

select pg_temp.expect_chat_phone_rejected('صفر تسعة اربعة اربعة خمسة تلاتة واحد 345');
select pg_temp.expect_chat_phone_rejected('0 9 4 4 5 3 1 345');

insert into pg_temp._phone_guard_chat_test(body, message_type)
values ('أحتاج مدرس رياضيات للصف التاسع', 'text');

rollback;
\echo 'PASS phone guard mixed digit words'
