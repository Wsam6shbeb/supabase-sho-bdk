// ===============================================================
// يسجّل جهاز المستخدم للـ Push بعد الدخول، ويفتح الشاشة المناسبة عند النقر على إشعار
// (والتطبيق في الخلفية أو مغلق تماماً).
// ===============================================================

import { registerPushToken } from '@/services/push';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// آخر إشعار تم التعامل معه. getLastNotificationResponseAsync يُرجع آخر نقرة حتى لو عولجت سابقاً،
// فبدون هذا السجل كان يُعاد فتح نفس الإشعار بعد تبديل الحساب (تسجيل خروج ثم دخول بحساب آخر).
let lastHandledNotificationId: string | null = null;

function openRouteFrom(response: Notifications.NotificationResponse | null | undefined) {
  if (!response) return;
  const notificationId = response.notification.request.identifier;
  if (notificationId === lastHandledNotificationId) return;
  lastHandledNotificationId = notificationId;

  const route = response.notification.request.content.data?.route;
  if (typeof route !== 'string' || !route.startsWith('/')) return;
  // تأخير بسيط ليسبقه توجيه الدخول الأولي (AppEntry) ثم نفتح وجهة الإشعار
  setTimeout(() => {
    try {
      router.push(route as never);
    } catch (err) {
      console.error('[push] فشل فتح وجهة الإشعار:', err);
    }
  }, 600);
}

export function usePushNotifications(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;

    void registerPushToken();

    // النقر على إشعار والتطبيق يعمل في الخلفية
    const subscription = Notifications.addNotificationResponseReceivedListener(openRouteFrom);

    // النقر على إشعار فتح التطبيق من الإغلاق التام
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openRouteFrom(response);
    });

    return () => subscription.remove();
  }, [userId]);
}
