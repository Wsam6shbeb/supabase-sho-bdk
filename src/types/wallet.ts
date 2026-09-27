// ===============================================================
// شرح الملف: هذا صفحة المحفظة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// تعريفات بيانات المحفظة والتوثيق.
// هذا الملف يعرّف نماذج البيانات التي يستخدمها الـFrontend الآن،
// مع إبقاء الأسماء متوافقة مع الـAPI المتوقع لاحقًا.

export type TransactionType = 'credit' | 'debit';

/** سبب المعاملة المالية. */
export type TransactionReason =
  | 'top_up'
  | 'commission'
  | 'commission_deduction'
  | 'welcome_bonus'
  | 'top_up'
  | 'adjustment'
  | 'refund';

/** معاملة مالية. */
export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  /** الرصيد بعد تنفيذ هذه العملية مباشرة. */
  balance_after: number;
  reason: TransactionReason;
  description: string;
  order_id: string | null;
  counterparty_name: string | null;
  created_at: string;
}

/** حالة طلب التحقق من الهوية. */
export type VerificationStatusType =
  | 'not_verified'
  | 'under_review'
  | 'verified'
  | 'rejected';

/** طلب توثيق الحساب. */
export interface VerificationRequest {
  id: string;
  user_id: string;
  status: VerificationStatusType;
  submitted_at: string;
  id_photo_uri: string;
  selfie_photo_uri: string;
  /** سبب الرفض عند رفض الطلب. */
  rejection_reason?: string | null;
}
