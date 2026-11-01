/**
 * قواعد محلية سريعة لحماية محادثات «شو بدك».
 * لا تعتمد على الذكاء الاصطناعي لاكتشاف أرقام الهاتف.
 */

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
const WESTERN_DIGITS = '01234567890123456789';

const SPOKEN_DIGITS: Record<string, string> = {
  صفر: '0',
  زيرو: '0',
  zero: '0',
  واحد: '1',
  واحدة: '1',
  واحده: '1',
  احد: '1',
  أحد: '1',
  one: '1',
  اثنين: '2',
  اتنين: '2',
  تنين: '2',
  ثنين: '2',
  two: '2',
  ثلاثة: '3',
  ثلاثه: '3',
  تلاتة: '3',
  تلاته: '3',
  three: '3',
  أربعة: '4',
  اربعة: '4',
  أربعه: '4',
  اربعه: '4',
  four: '4',
  خمسة: '5',
  خمسه: '5',
  five: '5',
  ستة: '6',
  سته: '6',
  six: '6',
  سبعة: '7',
  سبعه: '7',
  seven: '7',
  ثمانية: '8',
  ثمانيه: '8',
  تمانية: '8',
  تمنية: '8',
  تمنيه: '8',
  eight: '8',
  تسعة: '9',
  تسعه: '9',
  nine: '9',
};

/** يحوّل الأرقام العربية/الفارسية إلى أرقام غربية. */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const index = ARABIC_DIGITS.indexOf(digit);
    return index >= 0 ? WESTERN_DIGITS[index] : digit;
  });
}

/** يحوّل أسماء الأرقام الواضحة إلى أرقام، لكشف رقم الهاتف المكتوب بالكلمات. */
export function normalizeSpokenPhoneDigits(value: string): string {
  const withoutDiacritics = value.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
  return withoutDiacritics.replace(/[\p{L}]+/gu, (word) => {
    const normalized = word.toLocaleLowerCase('ar');
    return SPOKEN_DIGITS[normalized] ?? word;
  });
}

/**
 * يلتقط أرقام الهواتف الشائعة، بما فيها الأرقام السورية المحلية والدولية،
 * وكذلك أرقام الهاتف الطويلة المكتوبة مع مسافات أو شرطات أو أسماء الأرقام.
 * لا يعتبر الفواصل المستخدمة عادةً لتنسيق الأسعار جزءاً من رقم الهاتف.
 */
export function containsPhoneNumber(value: string): boolean {
  const text = normalizeSpokenPhoneDigits(normalizePhoneDigits(value));
  const patterns = [
    // سوريا: موبايل محلي أو مع رمز الدولة.
    /(?:^|[^\d])09[\s().-]*\d[\d\s().-]{6,}\d(?:$|[^\d])/,
    /(?:^|[^\d])(?:\+|00)?963[\s().-]*9[\s().-]*\d[\d\s().-]{6,}\d(?:$|[^\d])/,
    // أرقام دولية طويلة، مع رمز دولة اختياري وفواصل شائعة.
    /(?:^|[^\d])(?:\+|00)\s*\d[\d\s().-]{7,}\d(?:$|[^\d])/,
    // أرقام متصلة أو مفصولة بمسافات/شرطات؛ نستثني الفواصل لتقليل التباس الأسعار.
    /(?:^|[^\d])\d{9,15}(?:$|[^\d])/,
    /(?:^|[^\d])\d(?:[\s().-]+\d){8,14}(?:$|[^\d])/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}
