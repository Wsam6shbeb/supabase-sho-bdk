// ===============================================================
// إتمام الطلب والتقييم والسجل عبر Supabase.
// الحالة والتقييم والسمعة تُحسب كلها في السيرفر (لا يستطيع العميل تغييرها مباشرة).
// ===============================================================

import { supabase } from '@/services/supabase';
import { OrderStatus } from '@/types/common';
import type { Order } from '@/types/orders';

export function orderErrorMessage(code: string | null): string {
  switch (code) {
    case 'INVALID_STATE':
      return 'ما بقدر تنفّذ هالإجراء بحالة الطلب الحالية.';
    case 'NO_ACTIVE_AGREEMENT':
      return 'ما في اتفاق فعّال على هالطلب.';
    case 'REQUEST_NOT_FOUND':
      return 'ما لقينا هالطلب.';
    case 'ALREADY_RATED':
      return 'سبق وقيّمت هالطلب.';
    case 'INVALID_SCORE':
      return 'التقييم لازم يكون من 1 لـ 5 نجوم.';
    case 'FORBIDDEN':
      return 'ما عندك صلاحية لهالإجراء.';
    case 'REASON_REQUIRED':
      return 'اكتب سبب البلاغ.';
    default:
      return 'صار خطأ بالاتصال. جرّب مرة ثانية.';
  }
}

/** الزبون يعلن انتهاء الخدمة: الطلب ينتقل لمرحلة "بانتظار التقييم". */
export async function completeRequest(
  requestId: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { error } = await supabase.rpc('complete_request', { p_request_id: requestId });
    return error ? { ok: false, error: error.message } : { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'NETWORK_ERROR' };
  }
}

/** تقييم الطرف الآخر (مرة واحدة). تقييم الزبون يغلق الطلب ويحدّث سمعة مقدم الخدمة. */
export async function submitRating(params: {
  requestId: string;
  score: number;
  comment?: string;
  tags?: string[];
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { error } = await supabase.rpc('submit_rating', {
      p_request_id: params.requestId,
      p_score: params.score,
      p_comment: params.comment ?? undefined,
      p_tags: params.tags ?? undefined,
    });
    return error ? { ok: false, error: error.message } : { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'NETWORK_ERROR' };
  }
}

/** اعتماد الطلبات المتأخرة عن مهلة التقييم تلقائياً (آمن ومتكرر). */
export async function finalizeOverdueRequests(): Promise<void> {
  const { error } = await supabase.rpc('finalize_overdue_requests');
  if (error) console.error('[orders] فشل اعتماد الطلبات المتأخرة:', error.message);
}

function mapStatus(state: string): OrderStatus {
  switch (state) {
    case 'completion_pending_rating':
      return OrderStatus.COMPLETION_PENDING_RATING;
    case 'completed':
      return OrderStatus.COMPLETED;
    case 'not_executed_review':
      return OrderStatus.NOT_EXECUTED_REVIEW;
    case 'cancelled':
    case 'expired':
      return OrderStatus.CANCELLED;
    default:
      return OrderStatus.POSTED;
  }
}

/** سجل طلباتي المنتهية (مع مقدم الخدمة وتقييمي). null عند الفشل. */
export async function fetchOrderHistory(userId: string): Promise<Order[] | null> {
  const { data, error } = await supabase.rpc('get_my_order_history_v2');
  if (error) {
    console.error('[orders] فشل جلب سجل الطلبات:', error.message);
    return null;
  }
  return (data ?? []).map((r) => ({
    id: r.request_id,
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    my_role: r.my_role as 'customer' | 'provider',
    description: r.description,
    is_urgent: r.is_urgent,
    status: mapStatus(r.state),
    region_id: r.region ?? '',
    created_at: r.created_at,
    updated_at: r.updated_at,
    completed_at: r.completed_at,
    provider_id: r.provider_id,
    provider_name: r.provider_name,
    agreed_price: r.agreed_price != null ? Number(r.agreed_price) : null,
    commission_amount: r.commission_amount != null ? Number(r.commission_amount) : null,
    customer_rating: r.my_rating,
    customer_comment: r.my_comment,
    customer_tags: r.my_tags ?? [],
    rating_deadline: r.rating_deadline,
    rating_auto_approved: false,
    rating_reminder_sent: false,
  }));
}

export interface ConversationRatingStatus {
  request_id: string;
  request_state: string;
  i_rated: boolean;
  my_score: number | null;
  has_non_execution_report: boolean;
}

/** حالة الطلب في هذه المحادثة وهل قيّمتُ الطرف الآخر (لبطاقة تقييم مقدم الخدمة). */
export async function getConversationRatingStatus(
  conversationId: string,
): Promise<ConversationRatingStatus | null> {
  try {
    const { data, error } = await supabase.rpc('get_conversation_rating_status', {
      p_conversation_id: conversationId,
    });
    if (error || !data) return null;
    return data as unknown as ConversationRatingStatus;
  } catch {
    return null;
  }
}

/** بلاغ عدم تنفيذ الخدمة: يغلق الطلب ويسجّل بلاغاً للمراجعة (بلا استرداد تلقائي). */
export async function reportNonExecution(
  requestId: string,
  reason: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { error } = await supabase.rpc('report_non_execution', {
      p_request_id: requestId,
      p_reason: reason,
    });
    return error ? { ok: false, error: error.message } : { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'NETWORK_ERROR' };
  }
}
