// ===============================================================
// شرح الملف: هذا صفحة الإعدادات.
// الدوال/الوظائف المعرّفة هنا: SettingsScreen، handleNotificationsToggle،
// handleSoundToggle، handleDarkModeToggle، handleDeleteAccount، handleBlockedList،
// SettingRow، SettingToggle.
// الأزرار هنا حقيقية: الإشعارات والصوت والمظهر تُحفظ على الجهاز (services/preferences)،
// وحالة التوثيق تأتي من قاعدة البيانات (useMyVerification).
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة الإعدادات
// ═══════════════════════════════════════════════════════════

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { useMyVerification } from '@/hooks/use-my-verification';
import { usePreferences } from '@/hooks/use-preferences';
import { deleteMyAccount } from '@/services/account';
import { setSoundEnabled, setThemePreference } from '@/services/preferences';
import { setPushNotificationsEnabled } from '@/services/push';
import { useTheme } from '@/hooks/use-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

// [شرح الدالة: SettingsScreen] يعرض إعدادات التطبيق والحساب والإجراءات الخاصة بها.
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const scheme = Colors[theme];
  const { logout } = useAuth();
  const { blockedProviderIds } = useOrder();
  const verification = useMyVerification();
  const { prefs, refresh } = usePreferences();

  // إذن الإشعارات على مستوى نظام الهاتف (قد يسحبه المستخدم من إعدادات الهاتف)
  const [osGranted, setOsGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh();
      Notifications.getPermissionsAsync()
        .then(({ status }) => {
          if (active) setOsGranted(status === 'granted');
        })
        .catch(() => {
          // على الويب/المحاكي قد لا يتوفر؛ نعتبر الإذن غير معروف
        });
      return () => {
        active = false;
      };
    }, [refresh]),
  );

  // الزر يظهر "مفعّل" فقط إذا فعّله المستخدم وإذن الهاتف ممنوح
  const notificationsOn = prefs.notificationsEnabled && osGranted !== false;

// [شرح الدالة: handleNotificationsToggle] يشغّل/يوقف وصول إشعارات Push لهذا الجهاز.
  const handleNotificationsToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    const result = await setPushNotificationsEnabled(next);
    setBusy(false);
    refresh();

    if (result.ok) {
      if (next) setOsGranted(true);
      return;
    }
    if (result.reason === 'permission_denied') {
      Alert.alert(
        'الإشعارات غير مسموحة',
        'فعّل إذن الإشعارات لهذا التطبيق من إعدادات الهاتف، ثم ارجع وشغّل الزر.',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'فتح الإعدادات', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    Alert.alert('', 'تعذّر تغيير الإعداد. تحقق من الاتصال وحاول مجدداً.');
  };

// [شرح الدالة: handleSoundToggle] يحفظ تفضيل صوت الإشعارات على هذا الجهاز.
  const handleSoundToggle = async (next: boolean) => {
    await setSoundEnabled(next);
    refresh();
  };

// [شرح الدالة: handleDarkModeToggle] يبدّل مظهر التطبيق بين الفاتح والداكن ويحفظه.
  const handleDarkModeToggle = (next: boolean) => {
    void setThemePreference(next ? 'dark' : 'light');
  };

// [شرح الدالة: handleDeleteAccount] يبدأ عملية حذف الحساب بعد التحقق من الإجراء المطلوب.
  const handleDeleteAccount = () => {
    Alert.alert(
      'حذف الحساب',
      'سيتم حذف بياناتك الشخصية (الاسم، رقم الهاتف، الإيميل، خدماتك ونبذتك) ولن تتمكن من الدخول بهذا الحساب مجدداً. ' +
        'قد يبقى سجل المحادثات والتقييمات والعمليات المالية بدون أي بيانات تعرّف بك، لحماية الطرف الآخر ولمنع الاحتيال. ' +
        'أي رصيد متبقٍ في محفظتك سيُفقد. لا يمكن التراجع عن هذا الإجراء.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await deleteMyAccount();
              if (!result.ok) {
                Alert.alert('تعذر حذف الحساب', result.error);
                return;
              }
              await logout();
              router.replace('/auth/login');
              Alert.alert('تم حذف حسابك', 'تم حذف بياناتك الشخصية. نتمنى لك التوفيق.');
            })();
          },
        },
      ],
    );
  };

// [شرح الدالة: handleBlockedList] يفتح قائمة المستخدمين المحظورين.
  const handleBlockedList = () => {
    router.push('/(drawer)/blocked-list');
  };

  const verificationLabel =
    verification.status === 'verified'
      ? 'موثّق ✓'
      : verification.status === 'under_review'
        ? 'قيد المراجعة'
        : 'غير موثّق';
  // الضغط يفتح شاشة التوثيق إلا إذا كان الحساب موثّقاً أو الطلب قيد المراجعة
  const canOpenVerification =
    verification.status === 'not_verified' || verification.status === 'rejected';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: scheme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      {/* Notifications */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <SettingToggle
          icon="notifications-outline"
          label="الإشعارات"
          value={notificationsOn}
          disabled={busy}
          onValueChange={(next) => void handleNotificationsToggle(next)}
        />
        <SettingToggle
          icon="volume-high-outline"
          label="صوت الإشعارات"
          value={prefs.soundEnabled}
          disabled={!notificationsOn}
          onValueChange={(next) => void handleSoundToggle(next)}
          isLast
        />
      </AppCard>

      {/* App */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: scheme.textSecondary }]}>
          التطبيق
        </Text>
        <SettingToggle
          icon="moon-outline"
          label="الوضع الليلي"
          value={theme === 'dark'}
          onValueChange={handleDarkModeToggle}
          isLast
        />
      </AppCard>

      {/* Privacy */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: scheme.textSecondary }]}>
          الخصوصية والأمان
        </Text>
        <SettingRow
          icon="shield-checkmark-outline"
          label="حالة التوثيق"
          value={verificationLabel}
          valueColor={
            verification.status === 'verified' ? scheme.success : scheme.textSecondary
          }
          onPress={canOpenVerification ? () => router.push('/orders/verify-account') : undefined}
        />
        <SettingRow
          icon="ban-outline"
          label="قائمة المحجوبين"
          value={blockedProviderIds.length > 0 ? `${blockedProviderIds.length}` : undefined}
          onPress={handleBlockedList}
        />
        <SettingRow
          icon="trash-outline"
          label="حذف الحساب"
          danger
          onPress={handleDeleteAccount}
          isLast
        />
      </AppCard>

      {/* Logout */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <Pressable
          onPress={async () => {
            await logout();
          }}
          style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="log-out-outline" size={22} color={scheme.danger} />
          <Text style={[styles.logoutText, { color: scheme.danger }]}>
            تسجيل الخروج
          </Text>
        </Pressable>
      </AppCard>

      <Text style={[styles.version, { color: scheme.textTertiary }]}>
        شو بدك؟ — الإصدار 1.0.0
      </Text>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════
interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  danger?: boolean;
  isLast?: boolean;
}

// [شرح الدالة: SettingRow] يعرض صفاً في الإعدادات (نص وقيمة وسهم اختياري عند وجود إجراء).
function SettingRow({
  icon,
  label,
  value,
  valueColor,
  onPress,
  danger,
  isLast,
}: SettingRowProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const color = danger ? scheme.danger : scheme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomColor: scheme.border, borderBottomWidth: 1 },
        { opacity: pressed && onPress ? 0.6 : 1 },
      ]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={22} color={color} />
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value && (
          <Text
            style={[
              styles.value,
              { color: valueColor ?? scheme.textSecondary },
            ]}
          >
            {value}
          </Text>
        )}
        {onPress && (
          <Ionicons name="chevron-back" size={20} color={scheme.textTertiary} />
        )}
      </View>
    </Pressable>
  );
}

interface SettingToggleProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}

// [شرح الدالة: SettingToggle] يعرض إعداد تشغيل/إيقاف تتحكم بقيمته الشاشة (controlled).
function SettingToggle({ icon, label, value, onValueChange, disabled, isLast }: SettingToggleProps) {
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomColor: scheme.border, borderBottomWidth: 1 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={22} color={scheme.text} />
        <Text style={[styles.label, { color: scheme.text }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: scheme.border, true: scheme.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.eight,
  },
  section: {
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  value: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  logoutText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  version: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: Spacing.six,
    writingDirection: 'rtl',
  },
});
