import { containsPhoneNumber, normalizeSpokenPhoneDigits } from '@/domain/chatSafety';

describe('chat phone safety', () => {
  it('detects Syrian numbers written as Arabic digit words', () => {
    expect(containsPhoneNumber('رقمي صفر تسعة خمسة خمسة واحد اثنين ثلاثة أربعة خمسة ستة')).toBe(true);
  });

  it('detects numbers with common Levantine spoken variants', () => {
    expect(containsPhoneNumber('صفر تسعة خمسة خمسة اتنين تلاتة اربعة خمسه سته سبعه')).toBe(true);
  });

  it('detects additional colloquial forms of eight in spoken phone numbers', () => {
    expect(containsPhoneNumber('صفر تسعة خمسة خمسة أربعة تلاتة تنين تمانه تمانة')).toBe(true);
    expect(containsPhoneNumber('صفر تسعة خمسة خمسة أربعة تلاتة تنين تمانية')).toBe(true);
  });

  it('detects numbers written as English digit words', () => {
    expect(containsPhoneNumber('my number is zero nine five five one two three four five six')).toBe(true);
  });

  it('keeps ordinary text and short number words allowed', () => {
    expect(containsPhoneNumber('السعر خمسة آلاف ليرة')).toBe(false);
    expect(containsPhoneNumber('عندي ثلاثة كتب')).toBe(false);
  });

  it('allows ordinary error numbers written in digits and words', () => {
    expect(containsPhoneNumber('هل الخطأ الظاهر عندك رقمه 79 تسعة وسبعين؟')).toBe(false);
  });

  it('normalizes spoken digits without changing surrounding words', () => {
    expect(normalizeSpokenPhoneDigits('رقمي صفر تسعة خمسة')).toBe('رقمي 0 9 5');
  });
});
