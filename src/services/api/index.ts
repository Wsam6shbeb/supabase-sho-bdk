// ===============================================================
// شرح الملف: هذا الشاشة الرئيسية/نقطة الدخول.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import * as mockAuth from '@/mocks/auth.mock';
import * as mockProviders from '@/mocks/providers.mock';
import { randomId } from '@/mocks/apiClient';
import { API_CONFIG, isHttpApiEnabled } from './config';
import { createBackendApi, SYRIAN_REGIONS } from './backendAdapter';

const backend = isHttpApiEnabled ? createBackendApi(API_CONFIG.baseUrl) : null;

export const api = {
  auth: backend ? { ...backend.auth, SYRIAN_REGIONS, getRegionById: (id: string) => SYRIAN_REGIONS.find((r) => r.id === id) ?? SYRIAN_REGIONS[0] } : mockAuth,
  providers: mockProviders,
  wallet: backend?.wallet,
  providerServices: backend?.providerServices,
  randomId,
};

export { API_CONFIG, isHttpApiEnabled };
export * from './contracts';
export * from './httpAdapter';
export * from './httpClient';

export type ApiAdapter = typeof api;
