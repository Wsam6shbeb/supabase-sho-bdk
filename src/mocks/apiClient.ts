// ===============================================================
// شرح الملف: هذا بيانات/خدمات تجريبية Mock (apiClient).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: randomBetween، delay، randomId.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// محاكاة API وعمليات الشبكة
// ═══════════════════════════════════════════════════════════

import type { ApiResponse, ApiError } from '@/types/common';

const DEFAULT_MIN_DELAY = 500;
const DEFAULT_MAX_DELAY = 1500;
const ERROR_PROBABILITY = 0.1;

/** توليد رقم عشوائي بين قيمتين */
// [شرح الدالة: randomBetween] ينتج رقمًا عشوائيًا ضمن المجال المحدد.
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** تأخير لمحاكاة وقت الاستجابة */
// [شرح الدالة: delay] يؤخر التنفيذ لمدة محددة لمحاكاة انتظار الشبكة أو الخادم.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** خيارات استدعاء API المحاكي */
export interface MockCallOptions<T> {
  resolver: () => T;
  minDelay?: number;
  maxDelay?: number;
  forceError?: boolean;
  errorOverride?: ApiError;
}

/** استدعاء API محاكي مع تأخير عشوائي وإمكانية الفشل */
export async function mockApiCall<T>(options: MockCallOptions<T>): Promise<ApiResponse<T>> {
  const {
    resolver,
    minDelay = DEFAULT_MIN_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    forceError = false,
    errorOverride,
  } = options;

  const waitFor = randomBetween(minDelay, maxDelay);
  await delay(waitFor);

  const shouldFail = forceError || Math.random() < ERROR_PROBABILITY;
  if (shouldFail) {
    const error = errorOverride ?? {
      code: 'ERR_NETWORK',
      message: 'مشكلة في الاتصال، تحقّق من الإنترنت',
    };
    return { success: false, error };
  }

  try {
    const data = resolver();
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
    return {
      success: false,
      error: { code: 'ERR_UNKNOWN', message },
    };
  }
}

/** توليد معرف فريد عشوائي */
// [شرح الدالة: randomId] ينشئ معرّفًا عشوائيًا للبيانات التجريبية.
export function randomId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
