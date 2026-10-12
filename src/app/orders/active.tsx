// ===============================================================
// شرح الملف: هذا صفحة الطلب النشط.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ActiveOrderScreen، openChat، reportNotExecuted، finishService.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة الخدمة النشطة
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { OrderStatus } from '@/types/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: ActiveOrderScreen] يعرض تفاصيل الطلب النشط والإجراءات المتاحة خلال تنفيذه.
export default function ActiveOrderScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { currentOrder, getProviderById, completeOrder } = useOrder();

  if (!currentOrder || currentOrder.status !== OrderStatus.ACTIVE || !currentOrder.provider_id) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
        <View style={styles.empty}>
          <Ionicons name="briefcase-outline" size={64} color={scheme.textTertiary} />
          <Text style={[styles.title, { color: scheme.text }]}>{t('orders.active.notFoundTitle')}</Text>
          <Text style={[styles.body, { color: scheme.textSecondary }]}>{t('orders.active.notFoundBody')}</Text>
          <AppButton title={t('common.back')} variant="primary" size="md" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const provider = getProviderById(currentOrder.provider_id);

// [شرح الدالة: openChat] يفتح محادثة الطلب مع الطرف المحدد.
  const openChat = () => {
    router.push({ pathname: '/orders/chat', params: { provider_id: currentOrder.provider_id! } });
  };

// [شرح الدالة: reportNotExecuted] يسجل أن الخدمة لم تُنفذ وينقل المستخدم إلى الإجراء المرتبط بذلك.
  const reportNotExecuted = () => {
    router.push({ pathname: '/orders/not-executed', params: { order_id: currentOrder.id, provider_id: currentOrder.provider_id!, provider_name: provider?.name ?? currentOrder.provider_name ?? 'مقدم الخدمة' } });
  };

// [شرح الدالة: finishService] ينفذ خطوة إنهاء الخدمة/الطلب.
  const finishService = async () => {
    const orderId = currentOrder.id;
    const result = await completeOrder();
    if (!result.ok) {
      Alert.alert('', result.error ?? 'تعذر إنهاء الخدمة. حاول مرة أخرى.');
      return;
    }
    router.replace({ pathname: '/orders/rate', params: { order_id: orderId } });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
      <View style={[styles.header, { borderBottomColor: scheme.border }]}>
        <AppButton title={t('common.back')} variant="ghost" size="sm" onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: scheme.text }]}>{t('orders.active.title')}</Text>
        <View style={{ width: 64 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.statusBanner, { backgroundColor: `${scheme.success}15` }]}>
          <Ionicons name="checkmark-circle" size={24} color={scheme.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: scheme.success }]}>{t('orders.active.status')}</Text>
            <Text style={[styles.statusBody, { color: scheme.textSecondary }]}>{t('orders.active.statusBody')}</Text>
          </View>
        </View>

        <AppCard padding="four" elevation="md" style={styles.card}>
          <Text style={[styles.label, { color: scheme.textSecondary }]}>{t('orders.active.requestLabel')}</Text>
          <Text style={[styles.description, { color: scheme.text }]}>{currentOrder.description}</Text>

          <View style={[styles.divider, { backgroundColor: scheme.border }]} />

          <Text style={[styles.label, { color: scheme.textSecondary }]}>{t('orders.active.providerLabel')}</Text>
          <Text style={[styles.provider, { color: scheme.text }]}>{provider?.name ?? currentOrder.provider_name ?? 'مقدم الخدمة'}</Text>

          {currentOrder.agreed_price != null && (
            <View style={styles.priceRow}>
              <Text style={[styles.label, { color: scheme.textSecondary }]}>{t('orders.active.priceLabel')}</Text>
              <Text style={[styles.price, { color: scheme.text }]}>{currentOrder.agreed_price} ل.س</Text>
            </View>
          )}
        </AppCard>

        <AppCard padding="four" elevation="sm" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={scheme.primary} />
            <Text style={[styles.infoText, { color: scheme.text }]}>{t('orders.active.chatHint')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={scheme.primary} />
            <Text style={[styles.infoText, { color: scheme.text }]}>{t('orders.active.supportHint')}</Text>
          </View>
        </AppCard>

        <View style={styles.actions}>
          <AppButton
            title={t('orders.active.openChat')}
            variant="secondary"
            size="lg"
            onPress={openChat}
            leadingIcon={<Ionicons name="chatbubble-outline" size={20} color={scheme.text} />}
          />
          <AppButton
            title={t('orders.active.finish')} 
            variant="primary"
            size="lg"
            onPress={finishService}
            leadingIcon={<Ionicons name="checkmark-done-circle" size={20} color={scheme.primaryContrast} />}
          />
        </View>

        {/* بلاغ "لم تُنفّذ الخدمة": رابط صغير وهادئ عمداً (قرار حساس تراجعه الإدارة يدوياً) */}
        <Pressable onPress={reportNotExecuted} hitSlop={10} style={styles.reportLink}>
          <Text style={[styles.reportLinkText, { color: scheme.textSecondary }]}>
            {t('orders.active.reportNotExecuted')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  reportLink: { alignSelf: 'center', marginTop: Spacing.four, paddingVertical: Spacing.one },
  reportLinkText: { fontSize: FontSizes.xs, textDecorationLine: 'underline', opacity: 0.7 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, writingDirection: 'rtl' },
  content: { flex: 1, padding: Spacing.six },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.four, borderRadius: Radii.lg, marginBottom: Spacing.four },
  statusTitle: { fontSize: FontSizes.base, fontWeight: FontWeights.bold, writingDirection: 'rtl' },
  statusBody: { fontSize: FontSizes.sm, marginTop: 2, writingDirection: 'rtl' },
  card: { marginBottom: Spacing.four },
  label: { fontSize: FontSizes.sm, writingDirection: 'rtl' },
  description: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, lineHeight: FontSizes.xl + 4, marginTop: Spacing.two, writingDirection: 'rtl', textAlign: 'right' },
  divider: { height: 1, marginVertical: Spacing.four },
  provider: { fontSize: FontSizes.base, fontWeight: FontWeights.semibold, marginTop: Spacing.two, writingDirection: 'rtl' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.four },
  price: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  infoCard: { marginBottom: Spacing.four },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.three },
  infoText: { flex: 1, fontSize: FontSizes.sm, writingDirection: 'rtl', textAlign: 'right' },
  actions: { gap: Spacing.three, marginTop: 'auto' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.six, gap: Spacing.three },
  title: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, textAlign: 'center', writingDirection: 'rtl' },
  body: { fontSize: FontSizes.base, textAlign: 'center', writingDirection: 'rtl', marginBottom: Spacing.three },
});
