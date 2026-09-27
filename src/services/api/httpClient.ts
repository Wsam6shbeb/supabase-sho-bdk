// ===============================================================
// شرح الملف: هذا ملف من طبقة الاتصال بالـ Backend/API (httpClient).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: createHttpClient.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import * as SecureStore from 'expo-secure-store';
import type { ApiError } from './contracts';

const AUTH_TOKEN_KEY = '@shobdk/auth_token';

export class ApiHttpError extends Error {
  constructor(public readonly error: ApiError, public readonly status: number) {
    super(error.message);
    this.name = 'ApiHttpError';
  }
}

export interface HttpClientOptions {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
}

// [شرح الدالة: createHttpClient] ينشئ عميل HTTP مشترك لإرسال الطلبات والتعامل مع الاستجابات.
export function createHttpClient(options: HttpClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const getToken = options.getToken ?? (() => SecureStore.getItemAsync(AUTH_TOKEN_KEY));

  async function request<T>(
    path: string,
    init: RequestInit = {},
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const token = await getToken();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    Object.entries(extraHeaders).forEach(([key, value]) => headers.set(key, value));

    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const raw = await response.text();
    let payload: unknown = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const body = payload as { error?: ApiError } | null;
      throw new ApiHttpError(
        body?.error ?? {
          code: `HTTP_${response.status}`,
          message: 'تعذر تنفيذ الطلب. حاول مرة أخرى.',
        },
        response.status,
      );
    }

    return payload as T;
  }

  return { request };
}
