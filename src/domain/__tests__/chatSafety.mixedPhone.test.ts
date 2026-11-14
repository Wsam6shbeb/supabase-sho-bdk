import { containsPhoneNumber } from '../chatSafety';

describe('containsPhoneNumber - mixed spoken digits and groups', () => {
  it.each([
    'صفر تسعة اربعة اربعة خمسة تلاتة واحد 345',
    '0 9 4 4 5 3 1 345',
    '0 9 44 531 345',
    '+ 9 6 3 9 4 4 5 3 1 3 4 5',
    '09\u200B44\u200B531\u200B345',
    'صفر تسعة 44 531 345',
  ])('rejects %s', (message) => expect(containsPhoneNumber(message)).toBe(true));

  it.each([
    'أحتاج مدرس رياضيات للصف التاسع',
    'السعر 1 500 000 ليرة',
    'شارع 5 بناء 12 الطابق 3',
    'خبرة 5 سنوات مع طلاب الصف 9 و10 و11',
    '3 غرف و2 حمام 120 متر',
    'مبلغ 1 000 000 000',
  ])('allows ordinary numeric text: %s', (message) => expect(containsPhoneNumber(message)).toBe(false));
});
