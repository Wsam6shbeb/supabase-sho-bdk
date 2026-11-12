// ===============================================================
// ثوابت قسم فرص العمل: الحدود (نفس قيود قاعدة البيانات) والنصوص العربية.
// ===============================================================

import type { ContactType, JobReportReason, JobStatus, JobType } from '@/types/jobs';

export const JOB_PAGE_SIZE = 20;

// يجب أن تطابق قيود جدول job_posts في Supabase.
export const JOB_LIMITS = {
  titleMin: 3,
  titleMax: 80,
  descriptionMin: 10,
  descriptionMax: 2000,
  regionMin: 2,
  regionMax: 40,
  areaMax: 60,
  salaryMax: 60,
  skillMax: 30,
  skillsCount: 10,
  detailsMax: 500,
} as const;

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  full_time: 'دوام كامل',
  part_time: 'دوام جزئي',
  freelance: 'عمل حر',
};

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  phone: 'هاتف',
  whatsapp: 'واتساب',
  email: 'بريد إلكتروني',
  link: 'رابط',
};

export const CONTACT_ACTION_LABELS: Record<ContactType, string> = {
  phone: 'اتصل الآن',
  whatsapp: 'تواصل عبر واتساب',
  email: 'أرسل بريداً إلكترونياً',
  link: 'افتح الرابط',
};

export const CONTACT_PLACEHOLDERS: Record<ContactType, string> = {
  phone: '09xxxxxxxx',
  whatsapp: '09xxxxxxxx أو +963xxxxxxxxx',
  email: 'name@example.com',
  link: 'https://...',
};

export const REPORT_REASON_LABELS: Record<JobReportReason, string> = {
  scam: 'احتيال أو وظيفة وهمية',
  inappropriate: 'محتوى غير لائق',
  spam: 'إعلان مزعج أو مكرر',
  other: 'سبب آخر',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: 'فعّالة',
  closed: 'مغلقة',
  hidden: 'مخفية من الإدارة',
};

export const JOB_DISCLAIMER =
  'التطبيق لا يتحقق من أصحاب الوظائف ولا يتدخل في التواصل بينكم. لا تدفع أي مبلغ مقابل الحصول على وظيفة.';

export const JOB_TYPE_OPTIONS = (Object.keys(JOB_TYPE_LABELS) as JobType[]).map((value) => ({
  value,
  label: JOB_TYPE_LABELS[value],
}));

export const CONTACT_TYPE_OPTIONS = (Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map(
  (value) => ({ value, label: CONTACT_TYPE_LABELS[value] }),
);

export const REPORT_REASON_OPTIONS = (Object.keys(REPORT_REASON_LABELS) as JobReportReason[]).map(
  (value) => ({ value, label: REPORT_REASON_LABELS[value] }),
);
