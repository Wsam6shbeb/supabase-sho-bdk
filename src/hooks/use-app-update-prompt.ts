// ===============================================================
// تنبيه تحديث التطبيق من إعدادات app_settings.
// التحقق عند تهيئة التطبيق وعند عودته إلى الواجهة، دون إشعار Push.
// ===============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

const db = supabase as unknown as SupabaseClient;
const DISMISSED_VERSION_KEY = '@sho-bdk/dismissed-app-update-version';
const DOWNLOAD_PAGE_FALLBACK = 'https://sho-bdk-download.vercel.app/';
const UPDATE_KEYS = [
  'app_update_enabled',
  'app_latest_version',
  'app_min_supported_version',
  'app_update_message',
  'app_update_url',
];

let lastPromptedVersion: string | null = null;
let promptVisible = false;

function parseVersion(value: unknown): number[] | null {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) return null;
  return value.split('.').map(Number);
}

function compareVersions(left: number[], right: number[]): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

export function useAppUpdatePrompt(isAppInitialized: boolean): void {
  useEffect(() => {
    if (!isAppInitialized || Platform.OS === 'web') return;

    let mounted = true;
    let checking = false;

    const checkForAppUpdate = async () => {
      if (!mounted || checking || promptVisible) return;
      checking = true;

      try {
        const { data, error } = await db
          .from('app_settings')
          .select('key,value')
          .in('key', UPDATE_KEYS);

        if (error || !mounted) return;

        const values = Object.fromEntries(
          ((data ?? []) as { key: string; value: unknown }[]).map((row) => [row.key, row.value]),
        );

        if (values.app_update_enabled !== true) return;

        const currentVersion = Constants.expoConfig?.version;
        const current = parseVersion(currentVersion);
        const latestVersion = values.app_latest_version;
        const latest = parseVersion(latestVersion);
        const minimum = parseVersion(values.app_min_supported_version);

        if (!current || !latest || !minimum) return;
        if (compareVersions(minimum, latest) > 0) return;
        if (compareVersions(current, latest) >= 0) return;

        const isRequired = compareVersions(current, minimum) < 0;
        const dismissedVersion = isRequired
          ? null
          : await AsyncStorage.getItem(DISMISSED_VERSION_KEY).catch(() => null);

        if (!mounted || (!isRequired && dismissedVersion === latestVersion)) return;
        if (lastPromptedVersion === latestVersion) return;

        const updateUrl =
          typeof values.app_update_url === 'string' && values.app_update_url.startsWith('https://')
            ? values.app_update_url
            : DOWNLOAD_PAGE_FALLBACK;
        const customMessage =
          typeof values.app_update_message === 'string' && values.app_update_message.trim()
            ? values.app_update_message.trim()
            : 'يتوفر إصدار أحدث من تطبيق شو بدك. حدّث التطبيق للاستفادة من التحسينات.';

        const message =
          customMessage +
          '\n\nالإصدار الحالي: ' + currentVersion +
          '\nالإصدار الجديد: ' + latestVersion;

        let updateActionChosen = false;
        const openDownloadPage = () => {
          updateActionChosen = true;
          promptVisible = false;
          lastPromptedVersion = null;
          void Linking.openURL(updateUrl).catch(() => {
            Alert.alert('تعذّر فتح صفحة التنزيل', 'تحقق من اتصال الإنترنت وحاول مجدداً.');
          });
        };

        lastPromptedVersion = latestVersion;
        promptVisible = true;

        if (isRequired) {
          Alert.alert(
            'تحديث مطلوب',
            message,
            [{ text: 'تنزيل التحديث', onPress: openDownloadPage }],
            { cancelable: false },
          );
        } else {
          Alert.alert(
            'تحديث جديد متاح',
            message,
            [
              {
                text: 'لاحقاً',
                style: 'cancel',
                onPress: () => {
                  updateActionChosen = true;
                  promptVisible = false;
                  void AsyncStorage.setItem(DISMISSED_VERSION_KEY, latestVersion).catch(() => {});
                },
              },
              { text: 'تنزيل التحديث', onPress: openDownloadPage },
            ],
            {
              cancelable: true,
              onDismiss: () => {
                promptVisible = false;
                if (!updateActionChosen) {
                  void AsyncStorage.setItem(DISMISSED_VERSION_KEY, latestVersion).catch(() => {});
                }
              },
            },
          );
        }
      } catch {
        // فشل الشبكة أو قراءة الإعدادات لا يمنع فتح التطبيق.
      } finally {
        checking = false;
      }
    };

    void checkForAppUpdate();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForAppUpdate();
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [isAppInitialized]);
}
