// ===============================================================
// مراجعة البلاغات من قبل الأدمن (قرار يدوي): رد عمولة المزود أو إغلاق البلاغ بدون رد.
// الدوال في قاعدة البيانات ترفض أي مستخدم ليس أدمن.
// ===============================================================
import { supabase } from '@/services/supabase';

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, args?: Record<string, unknown>): RpcResult =>
  (supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => RpcResult)(fn, args);

export interface AdminReport {
  id: string;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
  reason: string;
  details: string | null;
  resolution: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  request_id: string | null;
  request_text: string | null;
  request_state: string | null;
  reporter_name: string;
  target_name: string;
  agreement_id: string | null;
  price: number | null;
  commission_amount: number | null;
  currency: string | null;
  provider_name: string | null;
  requester_name: string | null;
  commission_charged: boolean;
  commission_refunded: boolean;
}

export async function fetchAdminReports(
  status: 'open' | 'all',
): Promise<{ ok: true; reports: AdminReport[] } | { ok: false; error: string }> {
  const { data, error } = await rpc('admin_list_reports', { p_status: status });
  if (error) {
    return { ok: false, error: error.message.includes('FORBIDDEN') ? 'غير مصرّح لك بهذه الشاشة.' : 'تعذر تحميل البلاغات.' };
  }
  return { ok: true, reports: (data as AdminReport[]) ?? [] };
}

export async function resolveAdminReport(
  reportId: string,
  refund: boolean,
  note?: string,
): Promise<{ ok: true; refunded: boolean } | { ok: false; error: string }> {
  const { data, error } = await rpc('admin_resolve_report', {
    p_report_id: reportId,
    p_refund: refund,
    p_note: note ?? null,
  });
  if (error) {
    const m = error.message;
    if (m.includes('ALREADY_RESOLVED')) return { ok: false, error: 'تمت معالجة هذا البلاغ مسبقاً.' };
    if (m.includes('NO_COMMISSION_TO_REFUND')) return { ok: false, error: 'لا توجد عمولة لردّها في هذا البلاغ.' };
    if (m.includes('COMMISSION_NOT_CHARGED')) return { ok: false, error: 'لم تُخصم عمولة على هذا الاتفاق.' };
    if (m.includes('FORBIDDEN')) return { ok: false, error: 'غير مصرّح لك بهذا الإجراء.' };
    return { ok: false, error: 'تعذر تنفيذ العملية الآن.' };
  }
  return { ok: true, refunded: Boolean((data as { refunded?: boolean } | null)?.refunded) };
}
