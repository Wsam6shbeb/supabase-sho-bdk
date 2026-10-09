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
// [شرح الدالة: extractPriceFromChat] يستخرج سعراً صريحاً من رسائل التفاوض، لا أي رقم عابر.
export function extractPriceFromChat(messages: ChatMessage[]): number | null {
  const normalizeDigits = (value: string) =>
    value.replace(/[٠-٩۰-۹]/g, (digit) =>
      String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(digit) % 10),
    );

  const candidates: number[] = [];
  const amountPattern = '(\\d[\\d,. ]{0,14})\\s*(ألف|الف|مليون)?';
  const priceCue = new RegExp('(?:السعر(?:\\\\s+النهائي)?|اتفقنا\\\\s+على|المبلغ|التكلفة|بسعر|بمبلغ|قيمته|قيمتها|يكلف|بيكلف)\\\\s*[:：-]?\\\\s*' + amountPattern, 'g');
  const currencyCue = new RegExp(amountPattern + '\\\\s*(?:ل\\\\.?\\\\s*س|ليرة(?:\\\\s+سورية)?|ليرات)', 'g');

  for (const message of messages) {
    if (message.is_system) continue;
    const text = normalizeDigits(message.content);
    for (const pattern of [priceCue, currencyCue]) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const raw = match[1].replace(/[,.\s]/g, '');
        const price = Number.parseInt(raw, 10);
        if (Number.isSafeInteger(price) && price > 0) candidates.push(price);
      }
    }
  }

  const unique = Array.from(new Set(candidates));
  // إذا ذُكرت أسعار مختلفة، لا نخمن أيها النهائي؛ يجب أن يكتب الطرفان السعر النهائي بوضوح.
  return unique.length === 1 ? unique[0] : null;
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
