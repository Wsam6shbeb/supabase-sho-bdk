// ===============================================================
// شرح الملف: هذا ملف يحتوي منطق العمل الأساسي (commission).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: extractPriceFromChat، estimateCommissionFromChat، clampCommission.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { BUSINESS_CONFIG } from '@/config/business';
import type { ChatMessage } from '@/types/orders';

/**
 * Frontend-only commission estimator.
 *
 * The Backend remains the source of truth for the actual commission and must
 * return a fixed commission snapshot as part of the agreement. This helper
 * exists only for mock/prototype flows where no Backend value is available.
 */
// [شرح الدالة: extractPriceFromChat] يستخرج السعر المحتمل من رسائل المحادثة.
export function extractPriceFromChat(messages: ChatMessage[]): number | null {
  const text = messages
    .filter((message) => !message.is_system)
    .map((message) => message.content)
    .join(' ');
  const amounts = text.match(/\b\d{2,}\b/g);
  if (!amounts?.length) return null;
  const price = Number.parseInt(amounts[amounts.length - 1], 10);
  return Number.isFinite(price) && price > 0 ? price : null;
}

// [شرح الدالة: estimateCommissionFromChat] يقدّر العمولة اعتمادًا على السعر المستخرج من المحادثة.
export function estimateCommissionFromChat(messages: ChatMessage[]): number {
  const price = extractPriceFromChat(messages);
  if (price == null) {
    return BUSINESS_CONFIG.commission.default;
  }
  if (!Number.isFinite(price) || price <= 0) {
    return BUSINESS_CONFIG.commission.default;
  }

  const calculated = Math.round(price * BUSINESS_CONFIG.commission.rate);
  return Math.min(
    BUSINESS_CONFIG.commission.max,
    Math.max(BUSINESS_CONFIG.commission.min, calculated),
  );
}

// [شرح الدالة: clampCommission] يضمن أن قيمة العمولة تبقى ضمن الحدود المسموح بها.
export function clampCommission(amount: number): number {
  return Math.min(
    BUSINESS_CONFIG.commission.max,
    Math.max(BUSINESS_CONFIG.commission.min, Math.round(amount)),
  );
}
