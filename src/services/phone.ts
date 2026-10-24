// ===============================================================
// رقم هاتف المستخدم + مشاركته مع الطرف الآخر (كله عبر دوال آمنة في قاعدة البيانات).
// ===============================================================
import { supabase } from '@/services/supabase';

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, args?: Record<string, unknown>): RpcResult =>
  (supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => RpcResult)(fn, args);

export const INVALID_PHONE_MESSAGE = 'اكتب رقم موبايل سوري صحيح، مثل 0912345678';

function friendlyError(message: string): string {
  if (message.includes('INVALID_PHONE')) return INVALID_PHONE_MESSAGE;
  if (message.includes('PHONE_REQUIRED')) return 'أضف رقم هاتفك أولاً من الملف الشخصي.';
  if (message.includes('NO_ACTIVE_AGREEMENT')) return 'المشاركة متاحة بعد تأكيد الاتفاق فقط.';
  if (message.includes('CONVERSATION_CLOSED')) return 'انتهت هذه المحادثة، ولا يمكن مشاركة الرقم الآن.';
  return 'تعذر إكمال العملية الآن. حاول مرة أخرى بعد قليل.';
}

/** يحفظ رقم المستخدم (يتحقق منه ويوحّد صيغته في السيرفر) ويرجع الرقم بالصيغة الدولية. */
export async function setMyPhone(
  phone: string,
): Promise<{ ok: true; phone: string } | { ok: false; error: string }> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { data, error } = await rpc('set_my_phone', { p_phone: phone });
    if (!error) return { ok: true, phone: String(data) };
    // مستخدم Google جديد: صف الملف الشخصي قد لا يكون أُنشئ بعد، نعيد المحاولة مرة
    if (error.message.includes('USER_NOT_FOUND') && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    return { ok: false, error: friendlyError(error.message) };
  }
  return { ok: false, error: friendlyError('') };
}

export interface PhoneShareStatus {
  available: boolean;
  agreement_state?: string;
  i_shared: boolean;
  other_shared: boolean;
  other_phone: string | null;
  other_name: string | null;
  i_have_phone: boolean;
  /** حالة المحادثة (read_only بعد انتهاء الخدمة). غير موجودة في الإصدارات القديمة من السيرفر. */
  conversation_state?: string;
  /** السيرفر يقرر: هل يُعرض زر "شارك رقمي" الآن؟ غير موجود في الإصدارات القديمة من السيرفر. */
  can_share?: boolean;
}

export async function fetchPhoneShareStatus(conversationId: string): Promise<PhoneShareStatus | null> {
  const { data, error } = await rpc('get_phone_share_status', { p_conversation_id: conversationId });
  if (error || !data) return null;
  return data as PhoneShareStatus;
}

export async function sharePhone(conversationId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await rpc('share_my_phone', { p_conversation_id: conversationId });
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true };
}
