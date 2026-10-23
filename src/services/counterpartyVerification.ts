// ===============================================================
// حالة توثيق الطرف الآخر في المحادثة + طلب توثيقه
// الاستعلام والطلب كلاهما عبر دوال السيرفر (لا يقرأ التطبيق جدول users للطرف الآخر).
// ===============================================================

import { supabase } from '@/services/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// الدوال الجديدة غير موجودة في الأنواع المولّدة، فنتعامل معها بدون أنواع
const db = supabase as unknown as SupabaseClient;

export interface CounterpartyVerification {
  /** الحساب معتمد من الأدمن */
  verified: boolean;
  /** أرسلتُ له طلب توثيق سابقاً في هذه المحادثة */
  requestedByMe: boolean;
}

/** null عند الفشل أو إن لم أكن طرفاً في المحادثة. */
export async function fetchCounterpartyVerification(
  conversationId: string,
): Promise<CounterpartyVerification | null> {
  try {
    const { data, error } = await db.rpc('get_counterparty_verification', {
      p_conversation_id: conversationId,
    });
    if (error) {
      // Temporary diagnostics: never log conversation IDs, returned data, or credentials.
      if (__DEV__) {
        console.warn('[verification] get_counterparty_verification RPC error', {
          code: error.code,
          message: error.message,
        });
      }
      return null;
    }

    if (data == null || (Array.isArray(data) && data.length === 0)) {
      if (__DEV__) {
        console.info('[verification] get_counterparty_verification returned no result');
      }
      return null;
    }

    if (__DEV__) {
      console.info('[verification] get_counterparty_verification succeeded');
    }
    const row = data as { verified?: boolean; requested_by_me?: boolean };
    return { verified: Boolean(row.verified), requestedByMe: Boolean(row.requested_by_me) };
  } catch (err) {
    if (__DEV__) {
      console.warn('[verification] get_counterparty_verification unexpected failure', {
        errorType: err instanceof Error ? err.name : 'UnknownError',
      });
    }
    return null;
  }
}

export function verificationRequestErrorMessage(code: string | null): string {
  if (!code) return 'حدث خطأ في الاتصال. حاول مرة أخرى.';
  if (code.includes('ALREADY_VERIFIED')) return 'حساب الطرف الآخر موثّق بالفعل.';
  if (code.includes('ALREADY_REQUESTED')) return 'أرسلت طلب التوثيق مسبقاً في هذه المحادثة.';
  if (code.includes('CONVERSATION_CLOSED')) return 'هذه المحادثة مغلقة.';
  if (code.includes('BLOCKED')) return 'لا يمكن إرسال الطلب لهذا المستخدم.';
  if (code.includes('ACCOUNT_SUSPENDED')) return 'حسابك موقوف حالياً.';
  if (code.includes('FORBIDDEN')) return 'ليست لديك صلاحية لتنفيذ هذا الإجراء.';
  return 'حدث خطأ في الاتصال. حاول مرة أخرى.';
}

/** يرسل للطرف الآخر رسالة نظام في المحادثة + إشعاراً (مرة واحدة لكل محادثة). */
export async function requestCounterpartyVerification(
  conversationId: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { error } = await db.rpc('request_counterparty_verification', {
      p_conversation_id: conversationId,
    });
    return error ? { ok: false, error: error.message } : { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'NETWORK_ERROR' };
  }
}
