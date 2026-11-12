// ===============================================================
// أنواع قسم فرص العمل (تطابق جداول job_posts و job_reports و job_ads في Supabase).
// ===============================================================

export type JobType = 'full_time' | 'part_time' | 'freelance';
export type ContactType = 'phone' | 'whatsapp' | 'email' | 'link';
export type JobStatus = 'active' | 'closed' | 'hidden';
export type JobReportReason = 'scam' | 'inappropriate' | 'spam' | 'other';

// صف وظيفة كما يرجع من القوائم. وسيلة التواصل (contact_value) لا تُجلب مع القوائم أبداً،
// بل من الدالة get_job_contact عند فتح تفاصيل الوظيفة فقط.
export interface JobPost {
  id: string;
  user_id: string;
  title: string;
  description: string;
  region: string;
  area: string | null;
  skills: string[];
  job_type: JobType;
  salary_text: string | null;
  contact_type: ContactType;
  status: JobStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface JobContact {
  contact_type: ContactType;
  contact_value: string;
}

export interface JobAd {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  priority: number;
}

export interface JobFilters {
  query: string;
  region: string;
  area: string;
  skill: string;
}

// ما يرسله نموذج الإضافة/التعديل.
export interface JobInput {
  title: string;
  description: string;
  region: string;
  area: string | null;
  skills: string[];
  job_type: JobType;
  salary_text: string | null;
  contact_type: ContactType;
  contact_value: string;
}

export interface JobsSettings {
  enabled: boolean;
  adEveryN: number;
}
