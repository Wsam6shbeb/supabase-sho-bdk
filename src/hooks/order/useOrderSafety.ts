// ===============================================================
// شرح الملف: هذا Hook خاص بمنطق الطلبات (useOrderSafety).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: useOrderSafety.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import type { CreateReportDto, Report } from '@/types/reports';

/** Local safety state for the prototype. The Backend will become the source of truth later. */
// [شرح الدالة: useOrderSafety] يجمع منطق حماية/سلامة الطلب في Hook واحد.
export function useOrderSafety() {
  const [reports, setReports] = useState<Report[]>([]);
  const [blockedProviderIds, setBlockedProviderIds] = useState<string[]>([]);

  const submitReport = useCallback((dto: CreateReportDto) => {
    const report: Report = {
      id: api.randomId('rep'),
      reporter_id: 'me',
      reporter_name: 'أنا',
      reported_user_id: dto.reported_user_id,
      reported_user_name: dto.reported_user_name,
      order_id: dto.order_id ?? null,
      category: dto.category,
      description: dto.description,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    setReports((prev) => [report, ...prev]);
  }, []);

  const blockProvider = useCallback((providerId: string) => {
    setBlockedProviderIds((prev) => (prev.includes(providerId) ? prev : [...prev, providerId]));
  }, []);

  const unblockProvider = useCallback((providerId: string) => {
    setBlockedProviderIds((prev) => prev.filter((id) => id !== providerId));
  }, []);

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
