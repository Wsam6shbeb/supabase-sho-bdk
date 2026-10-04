// ===============================================================
// Push: تسجيل جهاز المستخدم لدى Expo ثم حفظ الرمز في Supabase (push_tokens).
// السيرفر يرسل الإشعار تلقائياً (trigger -> دالة send-push) عند كل إشعار جديد.
//
// يتطلب: بناء dev client/EAS (وليس Expo Go)، ومشروع EAS (extra.eas.projectId)،
// وعلى Android بيانات FCM (google-services.json). بدونها نتخطى التسجيل بصمت.
// ===============================================================

import { supabase } from '@/services/supabase';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// إشعار يصل والتطبيق مفتوح: نعرض اللافتة والصوت
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

let warnedMissingProject = false;

/** يطلب الإذن ويرجع رمز Expo Push للجهاز، أو null إذا لم يكن ممكناً (محاكي، رفض الإذن، لا مشروع EAS). */
export async function getExpoPushToken(options: { askPermission: boolean }): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const projectId = getProjectId();
  if (!projectId) {
    if (!warnedMissingProject) {
      warnedMissingProject = true;
      console.warn('[push] لا يوجد EAS projectId في app.json (extra.eas.projectId)؛ تم تخطي تسجيل الإشعارات.');
    }
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && options.askPermission) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.error('[push] فشل الحصول على رمز Push:', err);
    return null;
  }
}

/** يحفظ رمز هذا الجهاز للمستخدم الحالي. */
export async function registerPushToken(): Promise<void> {
  const token = await getExpoPushToken({ askPermission: true });
  if (!token) return;

  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS,
  });
  if (error) console.error('[push] فشل حفظ رمز الجهاز:', error.message);
}

/** عند تسجيل الخروج: نزيل رمز هذا الجهاز حتى لا تصل إشعارات الحساب السابق. يُستدعى قبل signOut. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await getExpoPushToken({ askPermission: false });
    if (!token) return;
    const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
    if (error) console.error('[push] فشل إزالة رمز الجهاز:', error.message);
  } catch (err) {
    console.error('[push] خطأ أثناء إزالة رمز الجهاز:', err);
  }
}
