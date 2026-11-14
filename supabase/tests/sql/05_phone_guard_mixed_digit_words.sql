\\set ON_ERROR_STOP on
begin;
do $test$
begin
  assert public.contains_phone_number('صفر تسعة اربعة اربعة خمسة تلاتة واحد 345'), 'spoken digits mixed with group';
  assert public.contains_phone_number('0 9 4 4 5 3 1 345'), 'split prefix';
  assert public.contains_phone_number('0 9 44 531 345'), 'mixed groups';
  assert public.contains_phone_number('+ 9 6 3 9 4 4 5 3 1 3 4 5'), 'split country code';
  assert public.contains_phone_number(E'09\\u200B44\\u200B531\\u200B345'), 'zero width';
  assert not public.contains_phone_number('السعر 1 500 000 ليرة'), 'formatted price';
  assert not public.contains_phone_number('شارع 5 بناء 12 الطابق 3'), 'address';
  assert not public.contains_phone_number('3 غرف و2 حمام 120 متر'), 'property details';
end
$test$;
rollback;
\\echo 'PASS phone guard mixed digit words'
