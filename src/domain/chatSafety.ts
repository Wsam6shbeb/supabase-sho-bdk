/**
 * قواعد محلية سريعة لحماية محادثات «شو بدك».
 * لا تعتمد على الذكاء الاصطناعي لاكتشاف أرقام الهاتف.
 */

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
const WESTERN_DIGITS = '01234567890123456789';

export const PHONE_IN_TEXT_MESSAGE =
  'لا يمكن كتابة أرقام الهاتف هنا. يمكنك مشاركة رقمك مع الطرف الآخر بعد تأكيد الاتفاق عبر خانة «شارك رقم هاتفي». ';

const SPOKEN_DIGITS: Record<string, string> = {
  صفر: '0', زيرو: '0', zero: '0',
  واحد: '1', واحدة: '1', واحده: '1', احد: '1', أحد: '1', one: '1',
  اثنين: '2', اتنين: '2', تنين: '2', ثنين: '2', two: '2',
  ثلاثة: '3', ثلاثه: '3', تلاتة: '3', تلاته: '3', three: '3',
  أربعة: '4', اربعة: '4', أربعه: '4', اربعه: '4', four: '4',
  خمسة: '5', خمسه: '5', five: '5',
  ستة: '6', سته: '6', six: '6',
  سبعة: '7', سبعه: '7', seven: '7',
  ثمانية: '8', تمانه: '8', تمانة: '8', ثمانيه: '8',
  تمانية: '8', تمنية: '8', تمنيه: '8', eight: '8',
  تسعة: '9', تسعه: '9', nine: '9',
};

export function normalizePhoneDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const index = ARABIC_DIGITS.indexOf(digit);
    return index >= 0 ? WESTERN_DIGITS[index] : digit;
  });
}

export function normalizeSpokenPhoneDigits(value: string): string {
  const cleaned = value
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u064B-\u065F\u0670\u0640]/g, '');
  return cleaned.replace(/[\p{L}]+/gu, (word) => {
    const normalized = word.toLocaleLowerCase('ar');
    return SPOKEN_DIGITS[normalized] ?? word;
  });
}

/**
 * يلتقط أرقام الهواتف المتصلة أو المفصولة، بما فيها المزج بين كلمات الأرقام
 * ومجموعات رقمية مثل: «صفر تسعة ... واحد 345».
 */
export function containsPhoneNumber(value: string): boolean {
  const text = normalizeSpokenPhoneDigits(normalizePhoneDigits(value));
  const patterns = [
    /(?:^|[^\d])09[\s().-]*\d[\d\s().-]{6,}\d(?:$|[^\d])/,
    /(?:^|[^\d])(?:\+|00)?963[\s().-]*9[\s().-]*\d[\d\s().-]{6,}\d(?:$|[^\d])/,
    /(?:^|[^\d])(?:\+|00)\s*[1-9][\d\s().-]{7,}\d(?:$|[^\d])/,
    /(?:^|[^\d])\d{9,15}(?:$|[^\d])/,
    /(?:^|[^\d])\d(?:[\s().-]+\d){8,14}(?:$|[^\d])/,
    // بادئة سورية مفصولة: 0 9 ...
    /(?:^|[^\d])0[\s().-]*9[\s().-]*\d[\d\s().-]{6,}\d(?:$|[^\d])/,
    // رمز سوريا مفصول: 9 6 3 9 ...
    /(?:^|[^\d])(?:\+|00)?[\s().-]*9[\s().-]*6[\s().-]*3[\s().-]*9[\s().-]*\d[\d\s().-]{6,}\d(?:$|[^\d])/,
  ];
  if (patterns.some((pattern) => pattern.test(text))) return true;

  // تسلسل مختلط من أرقام مفردة ومجموعات: 9 أرقام على الأقل و3 مجموعات مفردة.
  const runs = text.match(/\d(?:[\s().-]*\d){7,}/g) ?? [];
  return runs.some((run) => {
    const digitCount = run.replace(/\D/g, '').length;
    const singleDigitTokens = run.split(/[\s().-]+/).filter((token) => /^\d$/.test(token)).length;
    return digitCount >= 9 && singleDigitTokens >= 3;
  });
}
