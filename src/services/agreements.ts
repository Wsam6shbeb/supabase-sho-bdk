// ===============================================================
// خدمة الاتفاقات عبر Supabase. كل العمليات تمر عبر دوال مربوطة بـ auth.uid():
// - request_agreement: الزبون يؤكد الاتفاق (العمولة تُحسب في السيرفر)
// - respond_agreement: مقدم الخدمة يوافق/يرفض (الخصم من المحفظة داخل السيرفر)
// - cancel_agreement: الزبون يلغي اتفاقاً ما زال بانتظار الموافقة
// - get_conversation_agreement: آخر اتفاق للمحادثة (مع إنهاء المهلة تلقائياً)
// ===============================================================

import { supabase } from '@/services/supabase';
import type { Database } from '@/types/database';

export type DbAgreement = Database['public']['Tables']['agreements']['Row'];

export interface AgreementResult {
  agreement: DbAgreement | null;
  error: string | null;
}

const fail = (message: string | undefined): AgreementResult => ({
  agreement: null,
  error: message ?? 'UNKNOWN_ERROR',
});

/** الزبون يؤكد الاتفاق مع مقدم الخدمة في هذه المحادثة. */
export async function requestAgreement(
  conversationId: string,
  price: number | null,
): Promise<AgreementResult> {
  try {
    const { data, error } = await supabase.rpc('request_agreement', {
      p_conversation_id: conversationId,
      p_price: price ?? undefined,
    });
    if (error || !data) return fail(error?.message);
    return { agreement: data as DbAgreement, error: null };
  } catch (err) {
    return fail(err instanceof Error ? err.message : undefined);
  }
}

/** مقدم الخدمة يوافق أو يرفض. INSUFFICIENT_BALANCE إذا لم يكفِ رصيده لخصم العمولة. */
export async function respondToAgreement(params: {
  agreementId: string;
  approve: boolean;
  reason?: string;
  sharePhone?: boolean;
}): Promise<AgreementResult> {
  try {
    const { data, error } = await supabase.rpc('respond_agreement', {
      p_agreement_id: params.agreementId,
      p_approve: params.approve,
      p_reason: params.reason ?? undefined,
      p_share_phone: params.sharePhone ?? false,
    });
    if (error || !data) return fail(error?.message);
    return { agreement: data as DbAgreement, error: null };
  } catch (err) {
    return fail(err instanceof Error ? err.message : undefined);
  }
}

/** الزبون يلغي اتفاقاً بانتظار الموافقة. */
export async function cancelAgreement(agreementId: string): Promise<AgreementResult> {
  try {
    const { data, error } = await supabase.rpc('cancel_agreement', {
      p_agreement_id: agreementId,
    });
    if (error || !data) return fail(error?.message);
    return { agreement: data as DbAgreement, error: null };
  } catch (err) {
    return fail(err instanceof Error ? err.message : undefined);
  }
}

/** آخر اتفاق للمحادثة (وينهي المهلة المنتهية تلقائياً). null إذا لا يوجد. */
export async function getConversationAgreement(
  conversationId: string,
): Promise<DbAgreement | null | undefined> {
  try {
    const { data, error } = await supabase.rpc('get_conversation_agreement', {
      p_conversation_id: conversationId,
    });
    if (error) {
      console.error('[agreements] فشل جلب الاتفاق:', error.message);
      return undefined; // undefined = فشل (نفرّقه عن "لا يوجد اتفاق")
    }
    return (data as DbAgreement[] | null)?.[0] ?? null;
  } catch (err) {
    console.error('[agreements] خطأ غير متوقع:', err);
    return undefined;
  }
}

/**
 * اشتراك لحظي بتغيّر الاتفاقات والمحادثات التي تخصني (RLS تقيّد ما يصلني).
 * onChange يُستدعى عند أي تغيير وعند كل (إعادة) اتصال.
 */
export function subscribeToAgreementChanges(
  onChange: () => void,
  options?: { conversationId?: string },
): () => void {
  const agreementFilter = options?.conversationId
    ? { filter: `conversation_id=eq.${options.conversationId}` }
    : {};
  const conversationFilter = options?.conversationId
    ? { filter: `id=eq.${options.conversationId}` }
    : {};

  const channel = supabase
    .channel(`agreements:${options?.conversationId ?? 'mine'}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'agreements', ...agreementFilter },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'conversations', ...conversationFilter },
      () => onChange(),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onChange();
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** رسائل خطأ مفهومة للمستخدم من رموز السيرفر. */
export function agreementErrorMessage(code: string | null): string {
  switch (code) {
    case 'INSUFFICIENT_BALANCE':
      return 'رصيدك غير كافٍ لخصم العمولة. اشحن رصيدك ثم وافق على الاتفاق.';
    case 'INVALID_STATE':
      return 'ما بقدر تبدأ اتفاق بهالمرحلة من المحادثة.';
    case 'ALREADY_AGREED':
      return 'في اتفاق قائم بالفعل على هالطلب.';
    case 'BLOCKED':
      return 'ما بقدر تتفق مع شخص حاظره. ألغِ الحظر أولاً.';
    case 'AGREEMENT_UNAVAILABLE':
      return 'هالاتفاق غير متاح حالياً.';
    case 'FORBIDDEN':
      return 'ما عندك صلاحية لهالإجراء.';
    case 'AGREEMENT_NOT_FOUND':
    case 'CONVERSATION_NOT_FOUND':
      return 'ما لقينا هالاتفاق. جرّب تحدّث الشاشة.';
    default:
      return 'صار خطأ بالاتصال. جرّب مرة ثانية.';
  }
}
