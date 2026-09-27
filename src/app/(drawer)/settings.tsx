// ===============================================================
// شرح الملف: هذا صفحة الإعدادات.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: SettingsScreen، handleDeleteAccount، handleBlockedList، SettingRow، SettingToggle.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة الإعدادات
// ═══════════════════════════════════════════════════════════

import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

// [شرح الدالة: SettingsScreen] يعرض إعدادات التطبيق والحساب والإجراءات الخاصة بها.
export default function SettingsScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { logout } = useAuth();
  const { isVerified, blockedProviderIds } = useOrder();

// [شرح الدالة: handleDeleteAccount] يبدأ عملية حذف الحساب بعد التحقق من الإجراء المطلوب.
  const handleDeleteAccount = () => {
    Alert.alert(
      'حذف الحساب',
      'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي',
          style: 'destructive',
          onPress: () => Alert.alert('قريباً', 'سيتم تفعيل حذف الحساب قريباً'),
        },
      ],
    );
  };

// [شرح الدالة: handleBlockedList] يفتح قائمة المستخدمين المحظورين.
  const handleBlockedList = () => {
    router.push('/(drawer)/blocked-list');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: scheme.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Notifications */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <SettingToggle
          icon="notifications-outline"
          label="الإشعارات"
          defaultValue={true}
        />
        <SettingToggle
          icon="volume-high-outline"
          label="صوت الإشعارات"
          defaultValue={true}
          isLast
        />
      </AppCard>

      {/* App */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: scheme.textSecondary }]}>
          التطبيق
        </Text>
        <SettingRow
          icon="language-outline"
          label="اللغة"
          value="العربية"
          onPress={() => Alert.alert('اللغة', 'العربية فقط حالياً')}
        />
        <SettingToggle
          icon="moon-outline"
          label="الوضع الليلي"
          defaultValue={false}
        />
        <SettingRow
          icon="lock-closed-outline"
          label="تغيير كلمة المرور"
          onPress={() => Alert.alert('قريباً', 'سيتم تفعيل تغيير كلمة المرور قريباً')}
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
          value={isVerified ? 'موثّق ✓' : 'غير موثّق'}
          valueColor={isVerified ? scheme.success : scheme.textSecondary}
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

// [شرح الدالة: SettingRow] تنفذ الدالة «SettingRow» المهمة البرمجية المرتبطة بهذا الملف وتعيد النتيجة التي يعتمد عليها باقي الكود.
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
  defaultValue?: boolean;
  isLast?: boolean;
}

// [شرح الدالة: SettingToggle] يعرض إعدادًا من نوع تشغيل/إيقاف ويتعامل مع تغيير قيمته.
function SettingToggle({ icon, label, defaultValue, isLast }: SettingToggleProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [value, setValue] = useState(defaultValue ?? false);

  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomColor: scheme.border, borderBottomWidth: 1 },
      ]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={22} color={scheme.text} />
        <Text style={[styles.label, { color: scheme.text }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={setValue}
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