// ===============================================================
// الحظر والبلاغات عبر Supabase.
// - blocks: الحظر يُطبَّق في السيرفر أيضاً (لا محادثة جديدة ولا رسائل بين المحظورَين).
// - reports: البلاغات تُحفظ لمراجعة الإدارة.
// ===============================================================

import { logFetchFailure } from '@/services/networkStatus';
import { supabase } from '@/services/supabase';
import type { CreateReportDto, Report, ReportStatus } from '@/types/reports';
import { useCallback, useEffect, useState } from 'react';

const REPORT_STATUS_MAP: Record<string, ReportStatus> = {
  open: 'pending',
  reviewed: 'reviewed',
  resolved: 'resolved',
  dismissed: 'rejected',
};

export function useOrderSafety(userId?: string | null) {
  const [reports, setReports] = useState<Report[]>([]);
  const [blockedProviderIds, setBlockedProviderIds] = useState<string[]>([]);

  // استعادة قائمة المحظورين وبلاغاتي من السيرفر عند الدخول
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setReports([]);
          setBlockedProviderIds([]);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const [blocksResult, reportsResult] = await Promise.all([
        supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
        supabase
          .from('reports')
          .select('id, reporter_id, target_user_id, request_id, reason, details, status, created_at')
          .eq('reporter_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (cancelled) return;

      if (blocksResult.error) {
        logFetchFailure('safety', 'فشل جلب المحظورين', blocksResult.error);
      } else {
        setBlockedProviderIds((blocksResult.data ?? []).map((b) => b.blocked_id));
      }

      if (reportsResult.error) {
        logFetchFailure('safety', 'فشل جلب البلاغات', reportsResult.error);
      } else {
        setReports(
          (reportsResult.data ?? []).map((r) => ({
            id: r.id,
            reporter_id: r.reporter_id,
            reporter_name: 'أنا',
            reported_user_id: r.target_user_id ?? '',
            reported_user_name: '',
            order_id: r.request_id,
            category: (r.reason as Report['category']) ?? 'other',
            description: r.details ?? '',
            status: REPORT_STATUS_MAP[r.status] ?? 'pending',
            created_at: r.created_at,
          })),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** يحفظ البلاغ في السيرفر. يرجع ok=false عند الفشل ليعرض الواجهة الخطأ. */
  const submitReport = useCallback(
    async (dto: CreateReportDto): Promise<{ ok: boolean; error?: string }> => {
      if (!userId) return { ok: false, error: 'يجب تسجيل الدخول لإرسال بلاغ.' };

      const { data, error } = await supabase
        .from('reports')
        .insert({
          reporter_id: userId,
          target_user_id: dto.reported_user_id || null,
          request_id: dto.order_id || null,
          reason: dto.category,
          details: dto.description,
        })
        .select('id, created_at')
        .single();

      if (error || !data) {
        logFetchFailure('safety', 'فشل إرسال البلاغ', error);
        return { ok: false, error: 'تعذر إرسال البلاغ. تحقق من الاتصال وحاول مرة أخرى.' };
      }

      setReports((prev) => [
        {
          id: data.id,
          reporter_id: userId,
          reporter_name: 'أنا',
          reported_user_id: dto.reported_user_id,
          reported_user_name: dto.reported_user_name,
          order_id: dto.order_id ?? null,
          category: dto.category,
          description: dto.description,
          status: 'pending',
          created_at: data.created_at,
        },
        ...prev,
      ]);
      return { ok: true };
    },
    [userId],
  );

  const blockProvider = useCallback(
    (providerId: string) => {
      setBlockedProviderIds((prev) => (prev.includes(providerId) ? prev : [...prev, providerId]));
      if (!userId) return;
      void supabase
        .from('blocks')
        .upsert({ blocker_id: userId, blocked_id: providerId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true })
        .then(({ error }) => {
          if (error) {
            logFetchFailure('safety', 'فشل حفظ الحظر', error);
            // نتراجع محلياً حتى لا تظهر الحالة محظورة وهي غير محفوظة
            setBlockedProviderIds((prev) => prev.filter((id) => id !== providerId));
          }
        });
    },
    [userId],
  );

  const unblockProvider = useCallback(
    async (providerId: string): Promise<void> => {
      setBlockedProviderIds((prev) => prev.filter((id) => id !== providerId));
      if (!userId) return;
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', providerId);
      if (error) {
        logFetchFailure('safety', 'فشل إلغاء الحظر', error);
        setBlockedProviderIds((prev) => (prev.includes(providerId) ? prev : [...prev, providerId]));
      }
    },
    [userId],
  );

  const isProviderBlocked = useCallback(
    (providerId: string) => blockedProviderIds.includes(providerId),
    [blockedProviderIds],
  );

  return {
    reports,
    blockedProviderIds,
    submitReport,
    blockProvider,
    unblockProvider,
    isProviderBlocked,
  };
}
