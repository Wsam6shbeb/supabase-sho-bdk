// ===============================================================
// حذف الحساب من داخل التطبيق (مطلوب من Google Play / App Store).
// الدالة delete_my_account في قاعدة البيانات تحذف/تُخفي البيانات الشخصية وتمنع الدخول مجدداً.
// ===============================================================
import { supabase } from '@/services/supabase';

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;

export async function deleteMyAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await (supabase.rpc as unknown as (fn: string) => RpcResult)('delete_my_account');
  if (!error) return { ok: true };
  if (error.message.includes('ACTIVE_WORK_IN_PROGRESS')) {
    return {
      ok: false,
      error: 'عندك اتفاق أو خدمة جارية مع شخص آخر. أنهِها أو ألغِها أولاً، ثم أعد محاولة حذف الحساب.',
    };
  }
  return { ok: false, error: 'تعذر حذف الحساب الآن. حاول مرة ثانية بعد قليل.' };
}
