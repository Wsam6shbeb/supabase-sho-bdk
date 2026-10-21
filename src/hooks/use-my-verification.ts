// ===============================================================
// useMyVerification — حالة توثيق المستخدم الحالي من Supabase
// يحدّث الحالة كلما عادت الشاشة للتركيز، ويوفّر دالة الإرسال.
// ===============================================================

import { useAuth } from '@/hooks/use-auth';
import {
  EMPTY_VERIFICATION,
  fetchMyVerification,
  submitVerificationPhotos,
  type MyVerification,
  type SubmitResult,
} from '@/services/verification';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useMyVerification() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState<MyVerification>(EMPTY_VERIFICATION);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(EMPTY_VERIFICATION);
      setLoading(false);
      return;
    }
    try {
      setData(await fetchMyVerification(userId));
    } catch (err) {
      // عند الفشل نُبقي آخر حالة معروفة بدل إظهار "غير موثّق" خطأً
      console.error('[verification] تعذّر جلب حالة التوثيق:', (err as { message?: string })?.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const submit = useCallback(
    async (idBase64: string, selfieBase64: string): Promise<SubmitResult> => {
      if (!userId) return { ok: false, message: 'سجّل الدخول أولاً.' };
      const result = await submitVerificationPhotos(userId, idBase64, selfieBase64);
      if (result.ok) await refresh();
      return result;
    },
    [userId, refresh],
  );

  return {
    status: data.status,
    submittedAt: data.submittedAt,
    rejectionReason: data.rejectionReason,
    isVerified: data.status === 'verified',
    loading,
    refresh,
    submit,
  };
}
