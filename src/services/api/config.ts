// ===============================================================
// شرح الملف: هذا ملف من طبقة الاتصال بالـ Backend/API (config).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

export const API_CONFIG = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '',
  mode: (process.env.EXPO_PUBLIC_API_MODE ?? 'http') as 'mock' | 'http',
};

export const isHttpApiEnabled = API_CONFIG.mode === 'http' && API_CONFIG.baseUrl.length > 0;
