// ===============================================================
// شرح الملف: هذا ملف من طبقة الاتصال بالـ Backend/API (mockAdapter).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import * as authApi from '@/mocks/auth.mock';
import * as providerApi from '@/mocks/providers.mock';
import { randomId } from '@/mocks/apiClient';

/**
 * Temporary frontend adapter. These implementations are mocks only.
 * Replace this adapter with the real Backend API client when the API contract
 * is available; UI code should continue importing from `@/services/api`.
 */
export const api = {
  auth: authApi,
  providers: providerApi,
  randomId,
};

export type ApiAdapter = typeof api;
