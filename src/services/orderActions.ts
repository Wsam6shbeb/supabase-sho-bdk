// ===============================================================
// إجراءات ما بعد الاتفاق: المزود يعلن إنهاء الخدمة، وأي طرف يبلّغ عن مشكلة.
// الإبلاغ لا يلغي الطلب؛ يُسجَّل للأدمن فقط (يراجعه يدوياً ويتصل بالطرفين).
// ===============================================================
import { t } from '@/i18n/ar';
import { isConnectionError, isOffline } from '@/services/networkStatus';
import { supabase } from '@/services/supabase';

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, args?: Record<string, unknown>): RpcResult =>
  (supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => RpcResult)(fn, args);

type Result = { ok: true } | { ok: false; error: string };

function friendly(message: string): string {
  if (message.includes('ALREADY_REPORTED')) return 'سبق وأرسلت بلاغاً عن هذا الطلب.';
  if (message.includes('REPORT_WINDOW_CLOSED')) return 'انتهت مهلة الإبلاغ عن هذا الطلب.';
  if (message.includes('DETAILS_REQUIRED')) return 'اكتب وصفاً مختصراً للمشكلة.';
  if (message.includes('INVALID_STATE')) return 'لا يمكن تنفيذ هذا الإجراء في الحالة الحالية للطلب.';
  if (message.includes('FORBIDDEN')) return 'لا تملك صلاحية الوصول إلى هذا الطلب.';
  if (message.includes('PHONE_NUMBER_NOT_ALLOWED')) {
    return 'لا يمكن كتابة أرقام الهاتف هنا. يمكنك مشاركة رقمك بعد تأكيد الاتفاق عبر خانة «شارك رقم هاتفي».';
  }
  // انقطاع الإنترنت ليس خطأ في العملية: نوضّح السبب الحقيقي بدل رسالة عامة
  if (isOffline() || isConnectionError(message)) return t('common.offline');
  return 'تعذر إكمال العملية الآن. حاول مرة أخرى بعد قليل.';
}

export interface CounterpartyRating {
  avg: number;
  count: number;
}

/** التقييم العام للطرف الآخر في المحادثة (مثلاً ليرى المزود تقييم الزبون قبل أن يوافق). */
export async function fetchCounterpartyRating(conversationId: string): Promise<CounterpartyRating | null> {
  const { data, error } = await rpc('get_counterparty_rating', { p_conversation_id: conversationId });
  if (error || !data) return null;
  return data as CounterpartyRating;
}

/** المزود: "أنهيت الخدمة" (يصل الزبون إشعار، ويُعتمد الطلب تلقائياً إن لم يرد خلال المهلة). */
export async function providerFinishService(requestId: string): Promise<Result> {
  const { error } = await rpc('provider_finish_service', { p_request_id: requestId });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** أي طرف: "إبلاغ عن مشكلة". لا يغيّر حالة الطلب. */
export async function reportProblem(requestId: string, details: string): Promise<Result> {
  const { error } = await rpc('report_problem', { p_request_id: requestId, p_details: details });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}
