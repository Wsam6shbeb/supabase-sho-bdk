// ===============================================================
// useCounterpartyVerification — حالة توثيق الطرف الآخر في محادثة محددة.
// تتحدّث كلما عادت الشاشة للتركيز. عند فشل الجلب نُبقي آخر حالة معروفة.
// ===============================================================

import {
  fetchCounterpartyVerification,
  requestCounterpartyVerification,
  verificationRequestErrorMessage,
  type CounterpartyVerification,
} from '@/services/counterpartyVerification';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useCounterpartyVerification(conversationId: string | null) {
  const [data, setData] = useState<CounterpartyVerification | null>(null);
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(async () => {
    if (!conversationId) return;
    const result = await fetchCounterpartyVerification(conversationId);
    if (result) setData(result);
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const request = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!conversationId) return { ok: false };
    setRequesting(true);
    const result = await requestCounterpartyVerification(conversationId);
    setRequesting(false);
    // "مرسل مسبقاً" ليس فشلاً: نعرض الحالة الصحيحة فقط
    if (result.ok || result.error?.includes('ALREADY_REQUESTED')) {
      await refresh();
      return { ok: true };
    }
    return { ok: false, message: verificationRequestErrorMessage(result.error) };
  }, [conversationId, refresh]);

  return { data, requesting, request, refresh };
}

export type CounterpartyVerificationState = ReturnType<typeof useCounterpartyVerification>;
