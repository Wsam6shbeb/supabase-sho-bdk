// توحيد أخطاء طبقات API: التفاصيل في سجل المطوّر والرسائل للمستخدم بالعربية.
import { getUserMessage } from '@/services/errors';
import { logError } from '@/services/logger';
import { isOffline } from '@/services/networkStatus';

export interface AdapterFailure {
  success: false;
  error: { code: string; message: string };
}

export function dbFailure(
  operation: string,
  error: { code?: string | null; message: string },
  context: 'generic' | 'load' = 'load',
): AdapterFailure {
  logError(`[api] فشلت العملية (${operation}):`, error);
  return {
    success: false,
    error: { code: error.code || 'DB_ERROR', message: getUserMessage(error, context) },
  };
}

export function unauthenticated(message: string): AdapterFailure {
  return {
    success: false,
    error: { code: 'UNAUTHENTICATED', message: isOffline() ? getUserMessage({ message: 'Network request failed' }, 'load') : message },
  };
}
