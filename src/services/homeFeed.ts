// ===============================================================
// شريط الرئيسية: طلبات الناس الحديثة والخدمات المتاحة، نصوص فقط بدون أسماء ولا معرّفات.
// التنظيف (أرقام الهاتف والروابط والمحظورين وأهلية مقدم الخدمة...) يتم بالكامل في دالة قاعدة البيانات.
// أي فشل يعيد قائمة فارغة، فيبقى الشريط يعرض التلميحات.
// ===============================================================
import type { FeedEntry } from '@/domain/homeFeed';
import { logError } from '@/services/logger';
import { supabase } from '@/services/supabase';

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, args?: Record<string, unknown>): RpcResult =>
  (supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => RpcResult)(fn, args);

export async function fetchHomeFeedEntries(limit = 20): Promise<FeedEntry[]> {
  try {
    const { data, error } = await rpc('get_home_feed', { p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    const entries: FeedEntry[] = [];
    for (const row of data) {
      const kind = (row as { kind?: unknown })?.kind;
      const body = (row as { body?: unknown })?.body;
      if ((kind === 'request' || kind === 'offer') && typeof body === 'string' && body.trim().length > 0) {
        entries.push({ kind, text: body.trim() });
      }
    }
    return entries;
  } catch (err) {
    logError('[homeFeed] تعذر جلب شريط الرئيسية:', err);
    return [];
  }
}
