import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import { logError } from '@/services/logger';

export const GEMINI_BUSY_MESSAGE =
  'الخوادم مشغولة جداً، سنحاول إعادة إرسال طلبك تلقائياً خلال دقيقة تقريباً.';

const GEMINI_RETRY_DELAY_MS = 20_000;
const GEMINI_MAX_RETRIES = 3;

type FunctionResult<T> = { data: T | null; error: unknown | null };

async function isGeminiRateLimit(error: unknown): Promise<boolean> {
  const context = (error as { context?: Response } | null)?.context;
  if (!context || context.status !== 429 || typeof context.clone !== 'function') return false;
  try {
    const payload = await context.clone().json();
    return payload?.code === 'GEMINI_RATE_LIMITED';
  } catch {
    return false;
  }
}

async function reportExhausted(operation: 'analyze_service_request' | 'analyze_provider_service'): Promise<void> {
  try {
    const { error } = await supabase.from('app_error_log').insert({
      operation,
      error_code: 'GEMINI_RATE_LIMITED',
      http_status: 429,
      attempt_count: GEMINI_MAX_RETRIES + 1,
      platform: Platform.OS,
    });
    if (error) logError('[appErrorLog] تعذر تسجيل فشل Gemini النهائي:', error.message);
  } catch (error) {
    logError('[appErrorLog] تعذر تسجيل فشل Gemini النهائي:', error);
  }
}

/**
 * يعيد طلب Gemini فقط عند استجابة 429 الصريحة من Google.
 * لا يعيد أخطاء الصلاحيات أو التحقق أو حد الاستخدام الخاص بالمستخدم.
 */
export async function invokeGeminiWithRetry<T>(
  operation: 'analyze_service_request' | 'analyze_provider_service',
  invoke: () => Promise<FunctionResult<T>>,
  onRetry?: (retryNumber: number) => void,
): Promise<T | null> {
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    try {
      const { data, error } = await invoke();
      if (!error) return data;
      if (!(await isGeminiRateLimit(error))) {
        logError('[Gemini]', operation, 'فشل التحليل دون أن يكون خطأ تجاوز حصة Gemini.');
        return null;
      }
    } catch (error) {
      logError('[Gemini]', operation, 'تعذر تنفيذ استدعاء التحليل:', error);
      return null;
    }

    if (attempt === GEMINI_MAX_RETRIES) {
      await reportExhausted(operation);
      return null;
    }

    onRetry?.(attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_DELAY_MS));
  }
  return null;
}
