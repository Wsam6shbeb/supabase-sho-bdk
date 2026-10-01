// ===============================================================
// شرح الملف: هذا صفحة الإشعارات.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// أنواع الإشعارات
// ═══════════════════════════════════════════════════════════

/** أنواع الإشعارات الممكنة */
export type NotificationType =
  | 'order_created'
  | 'candidate_found'
  | 'agreement_confirmed'
  | 'agreement_approved'
  | 'agreement_rejected'
  | 'order_completed'
  | 'order_cancelled'
  | 'new_message'
  | 'rating_received'
  | 'verification_approved'
  | 'verification_rejected'
  | 'balance_low'
  | 'welcome_bonus'
  | 'rating_reminder'
  | 'rating_auto_approved'
    | 'ai_unavailable';   // ← ضيف هاد السطر


/** إشعار تطبيق */
export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** معرّف مرتبط (طلب، محادثة، ...) */
  reference_id?: string | null;
  /** رابط داخلي للتوجيه */
  route?: string | null;
  read: boolean;
  created_at: string;
}