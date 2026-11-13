const BLOCKED_WORDS = ['شرموطة', 'شرموطه', 'قحبة', 'قحبه'];

function normalizeArabicText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

/** فحص بسيط لكلمات مسيئة قبل إرسال النص من الواجهة. */
export function containsBlockedWord(...values: string[]): boolean {
  return values.some((value) => {
    const words = normalizeArabicText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
    return words.some((word) => BLOCKED_WORDS.some((blocked) => normalizeArabicText(blocked) === word));
  });
}
