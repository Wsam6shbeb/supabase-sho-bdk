// ===============================================================
// "تم الاستلام": ما دام التطبيق مفتوحاً ومسجّلاً الدخول، أي رسالة تصلني
// (حتى لو لم أفتح شاشة المحادثة) تُعلَّم فوراً بأنها وصلت، فيرى المرسل ✓✓.
// وعند فتح التطبيق أو عودته من الخلفية نعلّم كل ما وصل أثناء الغياب.
// ===============================================================

import { markAllMyMessagesDelivered, markMessagesDelivered } from '@/services/chat';
import { supabase } from '@/services/supabase';
import { useEffect } from 'react';
import { AppState } from 'react-native';

export function useChatDelivery(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    void markAllMyMessagesDelivered();

    // RLS تضمن أننا لا نتلقى إلا رسائل محادثاتنا
    const channel = supabase
      .channel(`delivery:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as { sender_id: string; conversation_id: string };
        if (row.sender_id !== userId) void markMessagesDelivered(row.conversation_id);
      })
      .subscribe((status) => {
        // بعد كل (إعادة) اتصال: ما فاتنا أثناء الانقطاع يُعلَّم أيضاً
        if (status === 'SUBSCRIBED') void markAllMyMessagesDelivered();
      });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void markAllMyMessagesDelivered();
    });

    return () => {
      appSub.remove();
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
