// ===============================================================
// شرح الملف: هذا تعريفات الأنواع TypeScript (reports).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// أنواع التقارير والشكاوى
// ═══════════════════════════════════════════════════════════

/** حالة التقرير */
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'rejected';

/** فئات التقارير */
export type NonExecutionReporter = 'customer' | 'provider';

export type NonExecutionStatus = 'pending_review' | 'cancelled_no_refund' | 'refund_pending' | 'admin_review';

export interface CreateNonExecutionReportDto {
  order_id: string;
  reporter_role: NonExecutionReporter;
  reason: string;
}

export type ReportCategory =
  | 'no_show'
  | 'late'
  | 'rude_behavior'
  | 'price_mismatch'
  | 'poor_quality'
  | 'commission_issue'
  | 'other';

/** تقرير عن مستخدم */
export interface Report {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reported_user_id: string;
  reported_user_name: string;
  order_id?: string | null;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  created_at: string;
  reviewed_at?: string | null;
}

/** بيانات إنشاء تقرير جديد */
export interface CreateReportDto {
  reported_user_id: string;
  reported_user_name: string;
  order_id?: string | null;
  category: ReportCategory;
  description: string;
}

/** خيار فئة التقرير للواجهة */
export interface ReportCategoryOption {
  id: ReportCategory;
  label: string;
  icon: string;
}