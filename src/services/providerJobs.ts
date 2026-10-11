// ===============================================================
// "أعمالي" لمقدم الخدمة: كل الاتفاقات التي هو طرف مقدم الخدمة فيها، مع حالتها وتقييماتها.
// ===============================================================

import { subscribeToAgreementChanges } from '@/services/agreements';
import { supabase } from '@/services/supabase';

export interface ProviderJob {
  agreement_id: string;
  request_id: string;
  conversation_id: string;
  agreement_state: string;
  request_state: string;
  requester_id: string;
  requester_name: string;
  request_text: string;
  region: string | null;
  price: number | null;
  commission_amount: number;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  /** @deprecated يرجع دائماً null: مقدم الخدمة لا يرى تقييم زبون محدد، فقط تقييمه العام. */
  rating_received: number | null;
  rating_given: number | null;
}

export type JobStage =
  | 'awaiting_my_approval'
  | 'in_progress'
  | 'awaiting_rating'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'expired';

/** مرحلة العمل كما يراها مقدم الخدمة (من حالة الاتفاق والطلب). */
export function getJobStage(job: ProviderJob): JobStage {
  switch (job.agreement_state) {
    case 'pending':
      return new Date(job.expires_at).getTime() <= Date.now() ? 'expired' : 'awaiting_my_approval';
    case 'rejected':
      return 'declined';
    case 'expired':
      return 'expired';
    case 'cancelled':
      return 'cancelled';
    default:
      break;
  }
  // الاتفاق فعّال: الحالة من الطلب
  switch (job.request_state) {
    case 'completion_pending_rating':
      return 'awaiting_rating';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'in_progress';
  }
}

export async function fetchMyProviderJobs(): Promise<ProviderJob[] | null> {
  const { data, error } = await supabase.rpc('get_my_provider_jobs');
  if (error) {
    console.error('[jobs] فشل جلب أعمالي:', error.message);
    return null;
  }
  return (data ?? []).map((r) => ({
    ...r,
    price: r.price != null ? Number(r.price) : null,
    commission_amount: Number(r.commission_amount),
  }));
}

/** إحصائيات مقدم الخدمة من ملفه (السيرفر هو الذي يحسبها). */
export async function fetchMyProviderStats(userId: string): Promise<{
  rating_avg: number;
  completed_services_count: number;
} | null> {
  const { data, error } = await supabase
    .from('provider_profiles')
    .select('rating_avg, completed_services_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    rating_avg: Number(data.rating_avg ?? 0),
    completed_services_count: Number(data.completed_services_count ?? 0),
  };
}

/** تحديث لحظي عند أي تغيّر في اتفاقاتي. */
export function subscribeToMyJobs(onChange: () => void): () => void {
  return subscribeToAgreementChanges(onChange);
}

export interface BlockedUser {
  user_id: string;
  full_name: string;
  region: string | null;
  blocked_at: string;
}

/** قائمة من حظرتُهم مع أسمائهم (من السيرفر، فتبقى بعد إعادة تشغيل التطبيق). */
export async function fetchBlockedUsers(): Promise<BlockedUser[] | null> {
  const { data, error } = await supabase.rpc('get_my_blocked_users');
  if (error) {
    console.error('[blocks] فشل جلب المحظورين:', error.message);
    return null;
  }
  return data ?? [];
}
