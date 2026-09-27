// ===============================================================
// شرح الملف: طبقة المحفظة (Wallet) — تقرأ الرصيد وسجل الحركات مباشرة
// من جداول Supabase (wallets, ledger_entries) بدل الـ Django backend القديم.
// السياسات (RLS) بجدولي wallets وledger_entries تسمح فقط بقراءة صفوف
// المستخدم الحالي (auth.uid()), فلا حاجة لتمرير user_id يدويًا بالفلترة
// لكن نمرره صراحة لتفادي أي التباس.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { supabase } from '@/services/supabase';
import type { ApiResponse } from '@/types/common';
import type { Transaction, TransactionReason } from '@/types/wallet';

// تحويل نوع القيد بجدول ledger_entries إلى سبب المعاملة المستخدم بالواجهة.
const LEDGER_TYPE_TO_REASON: Record<string, TransactionReason> = {
  commission_debit: 'commission_deduction',
  topup_credit: 'top_up',
  bonus_credit: 'welcome_bonus',
  refund_credit: 'refund',
  adjustment_credit: 'adjustment',
  adjustment_debit: 'adjustment',
};

// [شرح الدالة: isCredit] القيود المالية اسمها ينتهي بـ credit أو debit حسب نوعها.
function isCredit(entryType: string): boolean {
  return entryType.endsWith('_credit');
}

// [شرح الدالة: getCurrentUserId] يجلب معرّف المستخدم الحالي من جلسة Supabase.
async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const wallet = {
  // [شرح الدالة: getSummary] يجلب ملخص رصيد المحفظة للمستخدم الحالي.
  async getSummary(): Promise<ApiResponse<{ balance: number; alert_level: 'red' | 'yellow' | null; updated_at: string }>> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHENTICATED', message: 'يجب تسجيل الدخول لعرض المحفظة.' } };
    }
    const { data, error } = await supabase
      .from('wallets')
      .select('available_balance, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      return { success: false, error: { code: error.code || 'DB_ERROR', message: error.message } };
    }
    return {
      success: true,
      data: {
        balance: Number(data?.available_balance ?? 0),
        alert_level: null,
        updated_at: data?.updated_at ?? new Date().toISOString(),
      },
    };
  },

  // [شرح الدالة: getTransactions] يجلب سجل حركات المحفظة (ledger_entries) للمستخدم الحالي.
  async getTransactions(): Promise<ApiResponse<Transaction[]>> {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHENTICATED', message: 'يجب تسجيل الدخول لعرض المحفظة.' } };
    }
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('id, entry_type, amount, balance_after, reference_type, reference_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      return { success: false, error: { code: error.code || 'DB_ERROR', message: error.message } };
    }
    const transactions: Transaction[] = (data ?? []).map((row) => ({
      id: String(row.id),
      user_id: userId,
      type: isCredit(row.entry_type) ? 'credit' : 'debit',
      amount: Number(row.amount),
      balance_after: Number(row.balance_after),
      reason: LEDGER_TYPE_TO_REASON[row.entry_type] ?? 'adjustment',
      description: '',
      order_id: row.reference_type === 'service_request' && row.reference_id ? String(row.reference_id) : null,
      counterparty_name: null,
      created_at: row.created_at,
    }));
    return { success: true, data: transactions };
  },
};
