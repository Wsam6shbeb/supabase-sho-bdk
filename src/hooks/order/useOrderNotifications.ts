// ===============================================================
// إشعارات التطبيق = إشعارات السيرفر (محفوظة + لحظية) + إشعارات محلية فورية.
// إشعارات السيرفر تُنشأ بـ triggers عند أحداث الطرف الآخر (رسالة، اتفاق، إتمام، تقييم)
// فتصل حتى لو كان التطبيق مغلقاً، وتبقى بعد إعادة التشغيل.
// الإشعارات المحلية (pushNotification) لأحداث يعرفها التطبيق وحده (مثل رصيد منخفض).
// ===============================================================

import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { createRealtimeChannel } from '@/services/realtime';
import type { AppNotification, NotificationType } from '@/types/notifications';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface PushNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  referenceId?: string;
  route?: string;
}

interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

function mapDbNotification(row: DbNotification): AppNotification {
  const payload = row.payload ?? {};
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type as NotificationType,
    title: typeof payload.title === 'string' ? payload.title : '',
    body: typeof payload.body === 'string' ? payload.body : '',
    reference_id: typeof payload.reference_id === 'string' ? payload.reference_id : null,
    route: typeof payload.route === 'string' ? payload.route : null,
    read: !!row.read_at,
    created_at: row.created_at,
  };
}

const NOTIFICATION_COLUMNS = 'id, user_id, type, payload, read_at, created_at';

export function useOrderNotifications(userId?: string | null) {
  const [localNotifications, setLocalNotifications] = useState<AppNotification[]>([]);
  const [serverNotifications, setServerNotifications] = useState<AppNotification[]>([]);

  // ---------- تحميل + اشتراك لحظي بإشعارات السيرفر ----------
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setServerNotifications([]);
          setLocalNotifications([]);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(NOTIFICATION_COLUMNS)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) {
        console.error('[notifications] فشل جلب الإشعارات:', error.message);
        return;
      }
      setServerNotifications((data ?? []).map((r) => mapDbNotification(r as DbNotification)));
    };

    void load();

    const upsertRow = (row: DbNotification) => {
      if (cancelled) return;
      setServerNotifications((prev) => {
        const next = prev.filter((n) => n.id !== row.id);
        return [mapDbNotification(row), ...next].sort((a, b) => b.created_at.localeCompare(a.created_at));
      });
    };

    const channel = createRealtimeChannel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => upsertRow(payload.new as DbNotification),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as DbNotification & { expires_at?: string };
          // الإشعار المخفي (expires_at <= الآن) يُزال من القائمة
          if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
            setServerNotifications((prev) => prev.filter((n) => n.id !== row.id));
          } else {
            upsertRow(row);
          }
        },
      )
      // بعد كل (إعادة) اتصال نعيد الجلب لنلتقط ما فاتنا
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void load();
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const pushNotification = useCallback(({ type, title, body, referenceId, route }: PushNotificationInput) => {
    const notification: AppNotification = {
      id: api.randomId('notif'),
      user_id: 'me',
      type,
      title,
      body,
      reference_id: referenceId ?? null,
      route: route ?? null,
      read: false,
      created_at: new Date().toISOString(),
    };
    setLocalNotifications((prev) => [notification, ...prev]);
  }, []);

  const isServerId = useCallback(
    (id: string) => serverNotifications.some((n) => n.id === id),
    [serverNotifications],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      if (isServerId(id)) {
        setServerNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        void supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.error('[notifications] فشل تعليم القراءة:', error.message);
          });
      } else {
        setLocalNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      }
    },
    [isServerId],
  );

  const markAllNotificationsRead = useCallback(() => {
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setServerNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (userId) {
      void supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null)
        .then(({ error }) => {
          if (error) console.error('[notifications] فشل تعليم الكل كمقروء:', error.message);
        });
    }
  }, [userId]);

  // "حذف" = إخفاء (لا يوجد DELETE للعميل): ننهي صلاحية الإشعار
  const hideOnServer = useCallback(async (filter: { id?: string; userId?: string }) => {
    let query = supabase.from('notifications').update({ expires_at: new Date().toISOString() });
    if (filter.id) query = query.eq('id', filter.id);
    if (filter.userId) query = query.eq('user_id', filter.userId);
    const { error } = await query;
    if (error) console.error('[notifications] فشل إخفاء الإشعار:', error.message);
  }, []);

  const clearNotification = useCallback(
    (id: string) => {
      if (isServerId(id)) {
        setServerNotifications((prev) => prev.filter((n) => n.id !== id));
        void hideOnServer({ id });
      } else {
        setLocalNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    },
    [isServerId, hideOnServer],
  );

  const clearAllNotifications = useCallback(() => {
    setLocalNotifications([]);
    setServerNotifications([]);
    if (userId) void hideOnServer({ userId });
  }, [userId, hideOnServer]);

  const notifications = useMemo(
    () =>
      [...localNotifications, ...serverNotifications].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    [localNotifications, serverNotifications],
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.reduce((count, notification) => count + (notification.read ? 0 : 1), 0),
    [notifications],
  );

  return {
    notifications,
    unreadNotificationsCount,
    pushNotification,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotification,
    clearAllNotifications,
  };
}
