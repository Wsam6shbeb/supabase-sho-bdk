// ===============================================================
// شرح الملف: هذا نقطة الدخول لطبقة الوصول للبيانات بالواجهة الأمامية.
// المصادقة (auth) تمر عبر Supabase مباشرة (src/hooks/use-auth.tsx).
// هذا الملف يوفر: قائمة المناطق الثابتة، مزوّد بيانات المزوّدين
// التجريبي (mock)، محفظة المستخدم وخدمات مقدّم الخدمة (متصلتان الآن
// بـ Supabase)، ومولّد معرّفات عشوائية تُستخدم محليًا بالواجهة.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import * as mockProviders from '@/mocks/providers.mock';
import { randomId } from '@/mocks/apiClient';
import { SYRIAN_REGIONS, getRegionById } from './regions';
import { wallet } from './walletAdapter';
import { providerServices } from './providerServicesAdapter';

export const api = {
  auth: { SYRIAN_REGIONS, getRegionById },
  providers: mockProviders,
  wallet,
  providerServices,
  randomId,
};

export type ApiAdapter = typeof api;
