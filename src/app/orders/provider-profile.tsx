// ===============================================================
// شرح الملف: هذا صفحة ملف مقدم الخدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ProviderProfileScreen، handleClose، handleRequestAgain، handleReport، handleBlock، handleBlockAndReport.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة بروفايل مقدم الخدمة
// ═══════════════════════════════════════════════════════════

import { ProviderProfileCard } from '@/components/orders/ProviderProfileCard';
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { api } from '@/services/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// [شرح الدالة: ProviderProfileScreen] يعرض الملف الكامل لمقدم الخدمة والإجراءات المرتبطة به.
export default function ProviderProfileScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
    const {
    blockProvider,
    isProviderBlocked,
    hasCompletedOrderWith,
    getProviderById,
    openChat,
    getThreadByProviderId,
  } = useOrder();

  const providerId = params.provider_id as string;
  // const provider = api.providers.getProviderById(providerId);
  const provider = getProviderById(providerId);

  const blocked = isProviderBlocked(providerId);
  const hasChat = !!getThreadByProviderId(providerId);
  const openedFromChat = params.from === 'chat';
  const canRequestAgain = hasCompletedOrderWith(providerId);

  if (!provider) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={scheme.danger} />
          <Text style={[styles.errorText, { color: scheme.text }]}>
            مقدم الخدمة غير موجود
          </Text>
          <AppButton title={t('common.back')} variant="primary" size="md" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

// [شرح الدالة: handleClose] يغلق النافذة/الصفحة الحالية ويعيد المستخدم للمكان السابق.
  const handleClose = () => router.back();

// [شرح الدالة: handleOpenChat] يفتح محادثة مع مقدم الخدمة مباشرة من البروفايل.
  const handleOpenChat = () => {
    // إذا جئنا من شاشة المحادثة نفسها نرجع إليها بدل تكديس شاشة جديدة.
    if (openedFromChat && hasChat) {
      router.back();
      return;
    }

    const result = openChat(provider);
    if (!result.ok) {
      Alert.alert(
        '',
        result.reason === 'MAX_CHATS'
          ? t('orders.candidates.maxChatsWarning')
          : result.reason === 'BLOCKED'
            ? t('orders.candidates.blockedWarning')
            : t('orders.candidates.alreadyAgreedWarning'),
      );
      return;
    }

    router.push({
      pathname: '/orders/chat',
      params: { provider_id: provider.id },
    });
  };

// [شرح الدالة: handleRequestAgain] يبدأ طلب خدمة جديدًا اعتمادًا على المحادثة/الطلب السابق.
  const handleRequestAgain = () => {
    router.push({
      pathname: '/orders/request-again',
      params: { provider_id: provider.id },
    });
  };

// [شرح الدالة: handleReport] يفتح إجراء الإبلاغ المرتبط بالطلب.
  const handleReport = () => {
    router.push({
      pathname: '/orders/report',
      params: {
        reported_user_id: provider.id,
        reported_user_name: provider.name,
      },
    });
  };

// [شرح الدالة: handleBlock] ينفذ حظر المستخدم/مقدم الخدمة.
  const handleBlock = () => {
    Alert.alert(
      t('blocking.confirmTitle', { name: provider.name }),
      t('blocking.confirmBody'),
      [
        { text: t('blocking.cancelBtn'), style: 'cancel' },
        {
          text: t('blocking.confirmBtn'),
          style: 'destructive',
          onPress: () => {
            blockProvider(provider.id);
            router.back();
          },
        },
      ],
    );
  };

// [شرح الدالة: handleBlockAndReport] ينفذ الحظر والإبلاغ معًا حسب الإجراء المتاح.
  const handleBlockAndReport = () => {
    Alert.alert(
      t('blocking.confirmTitle', { name: provider.name }),
      t('blocking.confirmBody'),
      [
        { text: t('blocking.cancelBtn'), style: 'cancel' },
        {
          text: t('blocking.blockAndReport'),
          style: 'destructive',
          onPress: () => {
            blockProvider(provider.id);
            router.push({
              pathname: '/orders/report',
              params: {
                reported_user_id: provider.id,
                reported_user_name: provider.name,
              },
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]} edges={['top']}>
      <View style={styles.content}>
        {/* Header — سهم رجوع بدل الإغلاق */}
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            style={({ pressed }) => [
              styles.backBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="arrow-forward" size={26} color={scheme.primary} />
          </Pressable>

          {blocked && (
            <View style={[styles.blockedBadge, { backgroundColor: `${scheme.danger}15` }]}>
              <Ionicons name="ban" size={14} color={scheme.danger} />
              <Text style={[styles.blockedText, { color: scheme.danger }]}>
                {t('blocking.blocked')}
              </Text>
            </View>
          )}
        </View>

        <ProviderProfileCard
          provider={provider}
          onRequestAgain={handleRequestAgain}
          showRequestAgainButton={canRequestAgain && !blocked}
        />

        {/* الأزرار — مع paddingBottom للـ SafeArea */}
        <View
          style={[
            styles.actions,
            {
              paddingBottom: insets.bottom + Spacing.four,
              backgroundColor: scheme.background,
            },
          ]}
        >
          {!blocked && (
            <AppButton
              title={hasChat ? t('orders.candidates.returnToChat') : t('orders.candidates.openChat')}
              variant={hasChat ? 'secondary' : 'primary'}
              size="lg"
              onPress={handleOpenChat}
              leadingIcon={
                <Ionicons
                  name="chatbubble-ellipses"
                  size={18}
                  color={hasChat ? scheme.primary : scheme.primaryContrast}
                />
              }
            />
          )}

          <Pressable onPress={handleReport} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="flag-outline" size={20} color={scheme.warning} />
            <Text style={[styles.actionText, { color: scheme.warning }]}>
              {t('reports.title')}
            </Text>
          </Pressable>

          {!blocked && (
            <>
              <Pressable onPress={handleBlock} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Ionicons name="ban-outline" size={20} color={scheme.danger} />
                <Text style={[styles.actionText, { color: scheme.danger }]}>
                  {t('blocking.title')}
                </Text>
              </Pressable>

              <Pressable onPress={handleBlockAndReport} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Ionicons name="shield-outline" size={20} color={scheme.danger} />
                <Text style={[styles.actionText, { color: scheme.danger }]}>
                  {t('blocking.blockAndReport')}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  blockedText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  actions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  actionText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.six,
  },
  errorText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
});