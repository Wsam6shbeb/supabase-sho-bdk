// ===============================================================
// عمليات المحفظة عبر Supabase. الرصيد ودفتر الحسابات يُكتبان في السيرفر فقط
// (لا يستطيع العميل تعديلهما مباشرة).
// ===============================================================

import { supabase } from '@/services/supabase';

export function walletErrorMessage(code: string | null): string {
  switch (code) {
    case 'TOPUP_NOT_AVAILABLE':
      return 'الشحن غير متاح حالياً. تواصل مع الدعم لإضافة رصيد.';
    case 'INVALID_AMOUNT':
      return 'المبلغ غير صحيح.';
    case 'NOT_A_PROVIDER':
      return 'يجب أن تسجّل خدمة أولاً لتحصل على المكافأة.';
    default:
      return 'حدث خطأ في الاتصال. حاول مرة أخرى.';
  }
}

/** مكافأة الانضمام (مرة واحدة). المبلغ من إعدادات السيرفر. */
export async function claimWelcomeBonus(): Promise<{
  granted: boolean;
  amount: number;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('claim_welcome_bonus');
    if (error || !data) return { granted: false, amount: 0, error: error?.message ?? 'EMPTY_RESULT' };
    const result = data as { granted?: boolean; amount?: number };
    return { granted: !!result.granted, amount: Number(result.amount ?? 0), error: null };
  } catch (err) {
    return { granted: false, amount: 0, error: err instanceof Error ? err.message : 'NETWORK_ERROR' };
  }
}

/** شحن تجريبي: مغلق افتراضياً ويُفتح من إعدادات السيرفر فقط (لا توجد بوابة دفع بعد). */
export async function requestTestTopUp(
  amount: number,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { error } = await supabase.rpc('request_test_topup', { p_amount: amount });
    return error ? { ok: false, error: error.message } : { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'NETWORK_ERROR' };
  }
}
