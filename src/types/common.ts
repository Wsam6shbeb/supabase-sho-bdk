// ===============================================================
// شرح الملف: هذا تعريفات الأنواع TypeScript (common).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// أنواع مشتركة ومستخدمة في جميع التطبيق
// ═══════════════════════════════════════════════════════════

/** خطأ API */
export interface ApiError {
  code: string;
  message: string;
}

/** استجابة API ناجحة */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** استجابة API فاشلة */
export interface ApiFailure {
  success: false;
  error: ApiError;
}

/** استجابة API عامة (نجاح أو فشل) */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** حالات توثيق الحساب */
export enum VerificationStatus {
  NOT_VERIFIED = 'not_verified',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
}

/** حالات الطلب */
export enum OrderStatus {
  POSTED = 'posted',
  AWAITING_AGREEMENT = 'awaiting_agreement',
  ACTIVE = 'active',
  COMPLETION_PENDING_RATING = 'completion_pending_rating',
  NOT_EXECUTED_REVIEW = 'not_executed_review',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

/** حالات المحادثة */
export enum ChatStatus {
  NEGOTIATING = 'negotiating',
  AWAITING_APPROVAL = 'awaiting_approval',
  ACTIVE = 'active',
  LOCKED_NOT_CHOSEN = 'locked_not_chosen',
  LOCKED_COMPLETED = 'locked_completed',
}

/** منطقة سورية */
export interface Region {
  id: string;
  name_ar: string;
}
