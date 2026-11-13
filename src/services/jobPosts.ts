// ===============================================================
// خدمة قسم فرص العمل (Supabase): الوظائف، وسيلة التواصل، البلاغات، الإعلانات، الإعدادات.
//
// - الجداول الجديدة غير موجودة بعد في src/types/database.ts، لذلك نستعمل عميلاً بدون أنواع.
// - لا نستعمل select('*') أبداً: عمود contact_value محجوب عن القوائم في قاعدة البيانات،
//   ووسيلة التواصل تُجلب فقط من الدالة get_job_contact عند فتح التفاصيل.
// - الإعلانات لا تعطّل القائمة أبداً: أي فشل في جلبها يُتجاهل بصمت.
// ===============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { JOB_PAGE_SIZE } from '@/config/jobs';
import { getUserMessage, UserFacingError } from '@/services/errors';
import { supabase } from '@/services/supabase';
import type {
  JobAd,
  JobContact,
  JobFilters,
  JobInput,
  JobPost,
  JobReportReason,
  JobsSettings,
} from '@/types/jobs';
import { sanitizeFilterText } from '@/utils/jobs';

const db = supabase as unknown as SupabaseClient;

const JOB_COLUMNS =
  'id,user_id,title,description,region,area,skills,job_type,salary_text,contact_type,status,expires_at,created_at,updated_at';

const DEFAULT_AD_EVERY_N = 5;

// ---------- رسائل الأخطاء ----------

/** يحوّل أخطاء قواعد العمل في الخادم (RAISE EXCEPTION) إلى رسائل عربية مفهومة. */
export function jobErrorMessage(error: unknown): string {
  const text = String((error as { message?: unknown } | null)?.message ?? '');
  const code = (error as { code?: unknown } | null)?.code;

  if (text.includes('JOB_CONTENT_BLOCKED')) {
    return 'النص يحتوي على ألفاظ غير مسموحة. عدّل الإعلان وحاول مرة أخرى.';
  }
  if (text.includes('JOB_LIMIT_REACHED')) {
    return 'وصلت إلى الحد الأقصى من الوظائف الفعّالة. أغلق وظيفة قديمة ثم حاول مرة أخرى.';
  }
  if (text.includes('JOBS_DISABLED')) {
    return 'قسم فرص العمل غير متاح حالياً.';
  }
  if (text.includes('RATE_LIMITED')) {
    return 'طلبت معلومات تواصل كثيرة خلال وقت قصير. حاول مرة أخرى بعد قليل.';
  }
  if (text.includes('job_posts_contact_format')) {
    return 'وسيلة التواصل غير صحيحة. تحقق من الرقم أو الرابط.';
  }
  if (code === '23505') {
    return 'سبق أن أبلغت عن هذه الوظيفة.';
  }
  return getUserMessage(error, 'generic');
}

// ---------- مؤشر "تغيّرت الوظائف" لتحديث القائمة عند الرجوع إليها ----------

let jobsDirty = false;

export function markJobsDirty(): void {
  jobsDirty = true;
}

/** يرجع true مرة واحدة بعد أي إضافة/تعديل/حذف، ثم يصفّر المؤشر. */
export function consumeJobsDirty(): boolean {
  const was = jobsDirty;
  jobsDirty = false;
  return was;
}

// ---------- الإعدادات ----------

export async function fetchJobsSettings(): Promise<JobsSettings> {
  const { data, error } = await db
    .from('app_settings')
    .select('key,value')
    .in('key', ['jobs_enabled', 'jobs_ad_every_n']);
  if (error) throw error;

  const rows = (data ?? []) as { key: string; value: unknown }[];
  const enabled = rows.find((r) => r.key === 'jobs_enabled')?.value === true;
  const every = Number(rows.find((r) => r.key === 'jobs_ad_every_n')?.value);
  const adEveryN =
    Number.isFinite(every) && every >= 2 && every <= 20 ? Math.floor(every) : DEFAULT_AD_EVERY_N;
  return { enabled, adEveryN };
}

// ---------- الوظائف ----------

export async function listJobs(filters: JobFilters, page: number): Promise<JobPost[]> {
  const from = page * JOB_PAGE_SIZE;
  let query = db
    .from('job_posts')
    .select(JOB_COLUMNS)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .range(from, from + JOB_PAGE_SIZE - 1);

  const region = sanitizeFilterText(filters.region);
  if (region) query = query.ilike('region', `%${region}%`);

  const area = sanitizeFilterText(filters.area);
  if (area) query = query.ilike('area', `%${area}%`);

  // الخبرة: وسم مطابق، أو كلمة واردة في العنوان/الوصف
  const skill = sanitizeFilterText(filters.skill);
  if (skill) {
    query = query.or(
      `skills.cs.{"${skill}"},title.ilike.%${skill}%,description.ilike.%${skill}%`,
    );
  }

  const text = sanitizeFilterText(filters.query);
  if (text) {
    query = query.or(
      `title.ilike.%${text}%,description.ilike.%${text}%,skills.cs.{"${text}"}`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as JobPost[];
}

export async function listMyJobs(userId: string): Promise<JobPost[]> {
  const { data, error } = await db
    .from('job_posts')
    .select(JOB_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobPost[];
}

export async function getJob(jobId: string): Promise<JobPost | null> {
  const { data, error } = await db
    .from('job_posts')
    .select(JOB_COLUMNS)
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as JobPost | null;
}

/** وسيلة التواصل: للوظائف الفعّالة، أو لصاحب الوظيفة نفسه. */
export async function getJobContact(jobId: string): Promise<JobContact | null> {
  const { data, error } = await db.rpc('get_job_contact', { p_job_id: jobId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as JobContact | undefined;
  return row ?? null;
}

export async function createJob(userId: string, input: JobInput): Promise<string> {
  const { data, error } = await db
    .from('job_posts')
    .insert({ user_id: userId, ...input })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateJob(jobId: string, input: JobInput): Promise<void> {
  const { data, error } = await db.from('job_posts').update(input).eq('id', jobId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new UserFacingError('تعذر تعديل الوظيفة. ربما لم تعد متاحة.', 'unexpected');
  }
}

/** الإغلاق وإعادة الفتح. إعادة الفتح تجدّد مدة الوظيفة وتخضع للحد الأقصى من الوظائف الفعّالة. */
export async function setJobStatus(jobId: string, status: 'active' | 'closed'): Promise<void> {
  const { data, error } = await db
    .from('job_posts')
    .update({ status })
    .eq('id', jobId)
    .select('id,status');
  if (error) throw error;
  const row = (data as { id: string; status: string }[] | null)?.[0];
  if (!row) throw new UserFacingError('تعذر تحديث الوظيفة.', 'unexpected');
  if (row.status !== status) {
    throw new UserFacingError('لا يمكن تغيير حالة هذه الوظيفة.', 'permission');
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  const { error } = await db.from('job_posts').delete().eq('id', jobId);
  if (error) throw error;
}

// ---------- البلاغات ----------

export async function reportJob(
  jobId: string,
  reporterId: string,
  reason: JobReportReason,
  details: string,
): Promise<void> {
  const { error } = await db.from('job_reports').insert({
    job_id: jobId,
    reporter_id: reporterId,
    reason,
    details: details.trim() ? details.trim() : null,
  });
  if (error) throw error;
}

// ---------- الإعلانات ----------

export async function listJobAds(): Promise<JobAd[]> {
  try {
    const { data, error } = await db
      .from('job_ads')
      .select('id,title,image_url,link_url,priority')
      .order('priority', { ascending: false })
      .limit(20);
    if (error) return [];
    return (data ?? []) as JobAd[];
  } catch {
    return [];
  }
}

/** عدّاد المشاهدات والنقرات. لا ينتظره أحد ولا يظهر منه أي خطأ. */
export function trackAdEvent(adId: string, event: 'impression' | 'click'): void {
  void Promise.resolve(db.rpc('job_ad_event', { p_ad_id: adId, p_event: event })).catch(() => {});
}
