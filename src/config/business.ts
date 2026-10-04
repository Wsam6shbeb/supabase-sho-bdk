// ===============================================================
// شرح الملف: هذا إعدادات التطبيق (business).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

/** Frontend display/business constants mirrored from the MVP product specification.
 * Financial authority remains the Backend once the real API is connected.
 */
export const BUSINESS_CONFIG = {
  currency: 'ل.س',
  welcomeBonus: 300,
  commission: {
    min: 50,
    max: 1000,
    default: 100,
    rate: 0.05,
  },
  agreementApprovalTimeoutSeconds: 4 * 60,
  ratingAutoCompleteHours: 48,
  chatWritableAfterCompletionDays: 7,
  maxActiveConversations: 3,
} as const;
