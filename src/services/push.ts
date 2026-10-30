// ===============================================================
// Push: تسجيل جهاز المستخدم لدى Expo ثم حفظ الرمز في Supabase (push_tokens).
// السيرفر يرسل الإشعار تلقائياً (trigger -> دالة send-push) عند كل إشعار جديد.
//
// يتطلب: بناء dev client/EAS (وليس Expo Go)، ومشروع EAS (extra.eas.projectId)،
// وعلى Android بيانات FCM (google-services.json). بدونها نتخطى التسجيل بصمت.
//
// تفضيلات الجهاز (services/preferences):
// - الإشعارات متوقفة: لا نسجّل رمز الجهاز، ولا نعرض اللافتة والتطبيق مفتوح.
// - الصوت متوقف: لا صوت للإشعارات التي تصل والتطبيق مفتوح.
// ===============================================================

import {
  getPreferences,
  loadPreferences,
  setNotificationsEnabled,
} from '@/services/preferences';
import { isMessageForOpenConversation } from '@/services/activeConversation';
import { supabase } from '@/services/supabase';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logWarn, logError } from '@/services/logger';

// إشعار يصل والتطبيق مفتوح: نعرضه بحسب تفضيلات الجهاز، مع كتم رسائل المحادثة المفتوحة.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    await loadPreferences();
    const { notificationsEnabled, soundEnabled } = getPreferences();

    const hide = isMessageForOpenConversation(notification.request.content.data);
    const show = notificationsEnabled && !hide;

    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show && soundEnabled,
      shouldSetBadge: false,
    };
  },
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
      logWarn('[push] لا يوجد EAS projectId في app.json (extra.eas.projectId)؛ تم تخطي تسجيل الإشعارات.');
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
    logError('[push] فشل الحصول على رمز Push:', err);
    return null;
  }
}

/** يحفظ رمز هذا الجهاز للمستخدم الحالي (إلا إذا أوقف المستخدم الإشعارات على هذا الجهاز). */
export async function registerPushToken(): Promise<void> {
  await loadPreferences();
  if (!getPreferences().notificationsEnabled) return;

  const token = await getExpoPushToken({ askPermission: true });
  if (!token) return;

  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS,
  });
  if (error) logError('[push] فشل حفظ رمز الجهاز:', error.message);
}

/** يزيل رمز هذا الجهاز من السيرفر. يرجع false إذا فشلت الإزالة فعلاً (اتصال/خطأ). */
async function removeDeviceToken(): Promise<boolean> {
  try {
    const token = await getExpoPushToken({ askPermission: false });
    if (!token) return true; // لا رمز لهذا الجهاز (محاكي أو إذن مسحوب): لا شيء لإزالته
    const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
    if (error) {
      logError('[push] فشل إزالة رمز الجهاز:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    logError('[push] خطأ أثناء إزالة رمز الجهاز:', err);
    return false;
  }
}

/** عند تسجيل الخروج: نزيل رمز هذا الجهاز حتى لا تصل إشعارات الحساب السابق. يُستدعى قبل signOut. */
export async function unregisterPushToken(): Promise<void> {
  await removeDeviceToken();
}

export type PushToggleResult =
  | { ok: true }
  | { ok: false; reason: 'permission_denied' | 'unavailable' | 'network' };

/**
 * زر "الإشعارات" في الإعدادات.
 * - إيقاف: يزيل رمز الجهاز من السيرفر (فلا تصل إشعارات Push لهذا الجهاز) ثم يحفظ التفضيل.
 * - تشغيل: يطلب إذن النظام إن لزم، ثم يسجّل الجهاز ويحفظ التفضيل.
 * إشعارات داخل التطبيق (قائمة الإشعارات) لا تتأثر.
 */
export async function setPushNotificationsEnabled(enabled: boolean): Promise<PushToggleResult> {
  if (!enabled) {
    const removed = await removeDeviceToken();
    if (!removed) return { ok: false, reason: 'network' };
    await setNotificationsEnabled(false);
    return { ok: true };
  }

  if (Platform.OS === 'web' || !Device.isDevice) {
    await setNotificationsEnabled(true);
    return { ok: true };
  }

  const token = await getExpoPushToken({ askPermission: true });
  if (!token) {
    const { status } = await Notifications.getPermissionsAsync();
    return { ok: false, reason: status === 'granted' ? 'unavailable' : 'permission_denied' };
  }
  await setNotificationsEnabled(true);
  await registerPushToken();
  return { ok: true };
}
