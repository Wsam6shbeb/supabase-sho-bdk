// ===============================================================
// خدمات قائمة المستخدمين المحظورين.
// ===============================================================

import { supabase } from '@/services/supabase';

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
