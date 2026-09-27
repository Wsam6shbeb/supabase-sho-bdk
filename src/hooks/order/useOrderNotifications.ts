// ===============================================================
// شرح الملف: هذا Hook خاص بمنطق الطلبات (useOrderNotifications).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: useOrderNotifications.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { useCallback, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { AppNotification, NotificationType } from '@/types/notifications';

export interface PushNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  referenceId?: string;
  route?: string;
}

/** Owns notification UI state. Backend events can replace this implementation later. */
// [شرح الدالة: useOrderNotifications] يجمع منطق إشعارات الطلب في Hook واحد.
export function useOrderNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

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
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => setNotifications([]), []);

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
