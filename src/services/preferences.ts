// ===============================================================
// تفضيلات هذا الجهاز: الإشعارات، صوت الإشعارات، المظهر (فاتح/داكن).
// تُحفظ محلياً (AsyncStorage) وتُطبَّق تلقائياً عند تشغيل التطبيق.
// هي تفضيلات "الجهاز" لا "الحساب": تبقى كما هي لو بدّل المستخدم حسابه على نفس الجهاز.
// ===============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, Platform } from 'react-native';

export type ThemePreference = 'light' | 'dark';

export interface AppPreferences {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  /** null = لم يختر المستخدم بعد، فيتبع التطبيق مظهر الهاتف */
  theme: ThemePreference | null;
}

const KEYS = {
  notifications: 'prefs:notifications_enabled',
  sound: 'prefs:sound_enabled',
  theme: 'prefs:theme',
} as const;

let cache: AppPreferences = { notificationsEnabled: true, soundEnabled: true, theme: null };
let loading: Promise<void> | null = null;

function applyTheme(theme: ThemePreference | null) {
  if (theme === null || Platform.OS === 'web') return;
  try {
    // يغيّر مظهر التطبيق كله (useColorScheme يتحدّث تلقائياً في كل الشاشات)
    Appearance.setColorScheme(theme);
  } catch (err) {
    console.error('[prefs] تعذّر تطبيق المظهر:', (err as { message?: string })?.message);
  }
}

/** القيم الحالية من الذاكرة (تكون الافتراضية حتى يكتمل التحميل الأول). */
export function getPreferences(): AppPreferences {
  return cache;
}

/**
 * يقرأ التفضيلات المحفوظة مرة واحدة ويطبّق المظهر، ثم يرجع القيم الحالية دائماً
 * (وليس نسخة التحميل الأول، حتى لا تظهر قيمة قديمة بعد أي تغيير).
 */
export async function loadPreferences(): Promise<AppPreferences> {
  if (!loading) {
    loading = (async () => {
      try {
        const entries = await AsyncStorage.multiGet([KEYS.notifications, KEYS.sound, KEYS.theme]);
        const raw: Record<string, string | null> = Object.fromEntries(entries);
        const storedTheme = raw[KEYS.theme];
        cache = {
          notificationsEnabled: raw[KEYS.notifications] !== 'false',
          soundEnabled: raw[KEYS.sound] !== 'false',
          theme: storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null,
        };
      } catch (err) {
        // نبقي القيم الافتراضية إن تعذّرت القراءة
        console.error('[prefs] تعذّرت قراءة التفضيلات:', (err as { message?: string })?.message);
      }
      applyTheme(cache.theme);
    })();
  }
  await loading;
  return cache;
}

async function save(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (err) {
    console.error('[prefs] تعذّر حفظ التفضيل:', (err as { message?: string })?.message);
  }
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await loadPreferences();
  cache = { ...cache, notificationsEnabled: enabled };
  await save(KEYS.notifications, String(enabled));
}

export async function setSoundEnabled(enabled: boolean): Promise<void> {
  await loadPreferences();
  cache = { ...cache, soundEnabled: enabled };
  await save(KEYS.sound, String(enabled));
}

export async function setThemePreference(theme: ThemePreference): Promise<void> {
  await loadPreferences();
  cache = { ...cache, theme };
  applyTheme(theme);
  await save(KEYS.theme, theme);
}

// نبدأ التحميل فور استيراد الملف (يُستورد عند تشغيل التطبيق عبر services/push)
// حتى يُطبَّق المظهر المحفوظ بأسرع وقت.
void loadPreferences();
