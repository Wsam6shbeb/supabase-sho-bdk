// ===============================================================
// شرح الملف: هذا صفحة الملف الشخصي.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ProfileScreen، handleLogout، handleBecomeProvider، handleVerify، getVerificationBadge، SettingsRow.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة البروفايل من القائمة الجانبية
// ═══════════════════════════════════════════════════════════

import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { formatPhoneForDisplay } from '@/domain/phone';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// [شرح الدالة: ProfileScreen] يعرض ملف المستخدم وإجراءات الحساب وبيانات مقدم الخدمة إن وجدت.
export default function ProfileScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user, logout } = useAuth();
  const {
    hasProviderProfile,
    myProviderProfile,
    welcomeBonusReceived,
    balance,
    isCriticalBalance,
    verificationStatus,
    isVerified,
  } = useOrder();

// [شرح الدالة: handleLogout] ينفذ تسجيل خروج المستخدم وإنهاء الجلسة الحالية.
  const handleLogout = () => {
    // على الويب نستخدم نافذة تأكيد المتصفح لأن Alert.alert لا يظهر هناك.
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('هل أنت متأكد من تسجيل الخروج؟');
      if (confirmed) {
        void logout();
      }
      return;
    }

    // على الموبايل نستخدم نافذة التأكيد الأصلية الخاصة بـ React Native.
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          // logout يمسح حالة المصادقة فوراً، وAppEntry يتولى إعادة التوجيه
          // إلى شاشة تسجيل الدخول بعد تغير حالة المستخدم.
          await logout();
        },
      },
    ]);
  };

// [شرح الدالة: handleBecomeProvider] ينقل المستخدم إلى مسار إنشاء/تفعيل ملف مقدم خدمة.
  const handleBecomeProvider = () => {
    if (hasProviderProfile) {
      router.push('/orders/edit-provider-profile');
    } else {
      router.push('/orders/become-provider');
    }
  };

// [شرح الدالة: handleVerify] ينقل المستخدم إلى خطوات التحقق من الحساب.
  const handleVerify = () => {
    router.push('/orders/verify-account');
  };

// [شرح الدالة: getVerificationBadge] يحدد شارة التحقق المناسبة بحسب حالة التحقق الخاصة بالمستخدم.
  const getVerificationBadge = () => {
    switch (verificationStatus) {
      case 'verified':
        return {
          text: t('orders.providerProfile.verified'),
          color: scheme.success,
          icon: 'checkmark-circle' as const,
        };
      case 'under_review':
        return {
          text: t('orders.providerProfile.underReview'),
          color: scheme.warning,
          icon: 'time' as const,
        };
      default:
        return null;
    }
  };

  const verificationBadge = getVerificationBadge();

  return (
    <ScreenSafeArea
      style={[styles.safe, { backgroundColor: scheme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <AppCard padding="four" elevation="md" style={styles.profileCard}>
          <View style={styles.profileRow}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View
                style={[styles.avatarPlaceholder, { backgroundColor: `${scheme.primary}20` }]}
              >
                <Text style={[styles.avatarText, { color: scheme.primary }]}>
                  {user?.name?.charAt(0) ?? '؟'}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: scheme.text }]} numberOfLines={1}>
                  {user?.name ?? 'مستخدم'}
                </Text>
                {isVerified && (
                  <Ionicons name="checkmark-circle" size={18} color={scheme.success} />
                )}
              </View>
              <Text style={[styles.email, { color: scheme.textSecondary }]} numberOfLines={1}>
                {user?.email ?? ''}
              </Text>
              <Pressable
                onPress={() => router.push('/auth/complete-phone?mode=edit')}
                hitSlop={6}
                style={styles.regionRow}
              >
                <Ionicons name="call-outline" size={14} color={scheme.textSecondary} />
                <Text style={[styles.region, { color: scheme.textSecondary }]}>
                  {user?.phone ? formatPhoneForDisplay(user.phone) : 'أضف رقم هاتفك'}
                </Text>
                <Text style={[styles.region, { color: scheme.primary }]}>تعديل</Text>
              </Pressable>
              {user?.region && (
                <View style={styles.regionRow}>
                  <Ionicons name="location" size={14} color={scheme.textSecondary} />
                  <Text style={[styles.region, { color: scheme.textSecondary }]}>
                    {user.region.name_ar}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Verification Badge */}
          {verificationBadge && (
            <View
              style={[
                styles.verifiedBadge,
                { backgroundColor: `${verificationBadge.color}15` },
              ]}
            >
              <Ionicons
                name={verificationBadge.icon}
                size={16}
                color={verificationBadge.color}
              />
              <Text
                style={[styles.verifiedText, { color: verificationBadge.color }]}
              >
                {verificationBadge.text}
              </Text>
            </View>
          )}
        </AppCard>

        {/* زر التوثيق */}
        {!isVerified && verificationStatus !== 'under_review' && (
          <Pressable
            onPress={handleVerify}
            style={({ pressed }) => [
              styles.verifyBanner,
              {
                backgroundColor: `${scheme.primary}10`,
                borderColor: `${scheme.primary}40`,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.verifyIcon,
                { backgroundColor: `${scheme.primary}20` },
              ]}
            >
              <Ionicons name="shield-checkmark" size={28} color={scheme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifyTitle, { color: scheme.primary }]}>
                {t('verification.notVerifiedTitle')}
              </Text>
              <Text style={[styles.verifySubtitle, { color: scheme.textSecondary }]}>
                {t('verification.notVerifiedSubtitle')}
              </Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={scheme.primary} />
          </Pressable>
        )}

        {/* الرصيد */}
        <AppCard padding="four" elevation="sm" style={styles.section}>
          <Pressable
            onPress={() => router.push('/(drawer)/(tabs)/wallet')}
            style={styles.balanceRow}
          >
            <View
              style={[
                styles.balanceIcon,
                { backgroundColor: `${scheme.success}15` },
              ]}
            >
              <Ionicons name="wallet" size={24} color={scheme.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.balanceLabel, { color: scheme.textSecondary }]}>
                {t('wallet.currentBalance')}
              </Text>
              <Text style={[styles.balanceValue, { color: scheme.text }]}>
                {balance.toLocaleString()} ل.س
              </Text>
            </View>
            {isCriticalBalance && (
              <View
                style={[styles.alertDot, { backgroundColor: scheme.danger }]}
              />
            )}
            <Ionicons name="chevron-back" size={20} color={scheme.textTertiary} />
          </Pressable>
        </AppCard>

        {/* Provider Section */}
        {hasProviderProfile ? (
          <AppCard padding="four" elevation="sm" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="briefcase" size={20} color={scheme.primary} />
              <Text style={[styles.sectionTitle, { color: scheme.text }]}>
                كمقدم خدمة
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: scheme.primary }]}>
                  {myProviderProfile?.skills.length ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: scheme.textSecondary }]}>
                  مهارة
                </Text>
              </View>
              <View style={styles.statBox}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        myProviderProfile?.is_available
                          ? scheme.success
                          : scheme.textTertiary,
                    },
                  ]}
                />
                <Text style={[styles.statLabel, { color: scheme.textSecondary }]}>
                  {myProviderProfile?.is_available ? 'متاح' : 'غير متاح'}
                </Text>
              </View>
            </View>

            {/* عرض الخدمات/المهارات التي أضافها مقدم الخدمة */}
            <View style={styles.skillsList}>
              {myProviderProfile?.skills.map((skill) => (
                <View
                  key={skill.id}
                  style={[styles.skillChip, { backgroundColor: scheme.primary + '10' }]}
                >
                  <Ionicons name="checkmark-circle" size={17} color={scheme.primary} />
                  <Text style={[styles.skillText, { color: scheme.text }]} numberOfLines={2}>
                    {skill.name}
                  </Text>
                </View>
              ))}
            </View>

            {welcomeBonusReceived && (
              <View
                style={[styles.bonusBadge, { backgroundColor: `${scheme.warning}15` }]}
              >
                <Ionicons name="gift" size={16} color={scheme.warning} />
                <Text style={[styles.bonusText, { color: scheme.warning }]}>
                  استلمت مكافأة الانضمام
                </Text>
              </View>
            )}

            <AppButton
              title={t('home.editProfile.title')}
              variant="primary"
              size="md"
              onPress={handleBecomeProvider}
              style={{ marginTop: Spacing.three }}
              leadingIcon={
                <Ionicons name="pencil" size={16} color={scheme.primaryContrast} />
              }
            />
          </AppCard>
        ) : (
          <AppCard padding="four" elevation="sm" style={styles.section}>
            <View style={styles.becomeProviderWrap}>
              <View
                style={[styles.becomeIcon, { backgroundColor: `${scheme.warning}15` }]}
              >
                <Ionicons name="construct" size={32} color={scheme.warning} />
              </View>
              <Text style={[styles.becomeTitle, { color: scheme.text }]}>
                {t('home.becomeProvider.title')}
              </Text>
              <Text style={[styles.becomeSubtitle, { color: scheme.textSecondary }]}>
                احصل على 300 ل.س كمكافأة انضمام
              </Text>
              <AppButton
                title={t('home.becomeProvider.addSkillBtn')}
                variant="primary"
                size="lg"
                onPress={handleBecomeProvider}
                style={{ marginTop: Spacing.four }}
              />
            </View>
          </AppCard>
        )}

        {/* Settings List */}
        <AppCard padding="four" elevation="sm" style={styles.section}>
          <SettingsRow
            icon="chatbubble-outline"
            label={t('tabs.messages')}
            onPress={() => router.push('/(drawer)/(tabs)/messages')}
          />
          <SettingsRow
            icon="settings-outline"
            label="الإعدادات"
            onPress={() => console.log('Settings')}
          />
          <SettingsRow
            icon="log-out-outline"
            label={t('auth.logout')}
            danger
            onPress={handleLogout}
            isLast
          />
        </AppCard>
      </ScrollView>
    </ScreenSafeArea>
  );
}

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  isLast?: boolean;
}

// [شرح الدالة: SettingsRow] يعرض صف إعداد واحد داخل صفحة الإعدادات.
function SettingsRow({ icon, label, onPress, danger, isLast }: SettingsRowProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const color = danger ? scheme.danger : scheme.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        !isLast && { borderBottomColor: scheme.border, borderBottomWidth: 1 },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={styles.settingsRowLeft}>
        <Ionicons name={icon} size={22} color={color} />
        <Text style={[styles.settingsLabel, { color }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-back" size={20} color={scheme.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingBottom: Spacing.six,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  profileCard: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radii.full,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  name: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  email: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    marginBottom: Spacing.one,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  region: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.md,
    marginTop: Spacing.three,
  },
  verifiedText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radii.lg,
    borderWidth: 2,
  },
  verifyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  verifySubtitle: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    lineHeight: FontSizes.sm + 4,
  },
  section: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
    marginEnd: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  skillsList: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.md,
  },
  skillText: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  statValue: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginTop: Spacing.one,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: Radii.full,
    marginBottom: Spacing.two,
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.md,
    marginBottom: Spacing.two,
  },
  bonusText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  becomeProviderWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  becomeIcon: {
    width: 72,
    height: 72,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  becomeTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
    marginBottom: Spacing.one,
  },
  becomeSubtitle: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  settingsLabel: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
});