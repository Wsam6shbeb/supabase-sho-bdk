// ===============================================================
// شرح الملف: هذا صفحة الطلب الذي لم يُنفذ.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: NotExecutedScreen، submit.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import type { NonExecutionReporter } from '@/types/reports';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: NotExecutedScreen] يعرض خيارات التعامل مع الخدمة التي لم يتم تنفيذها.
export default function NotExecutedScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams();
  const { reportNonExecution, getOrderById } = useOrder();
  const orderId = String(params.order_id ?? '');
  const order = getOrderById(orderId);
  const providerName = String(params.provider_name ?? order?.provider_name ?? 'مقدم الخدمة');
  const [role, setRole] = useState<NonExecutionReporter>('customer');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

// [شرح الدالة: submit] ينفذ إرسال النموذج الحالي ويعالج النتيجة.
  const submit = () => {
    if (!reason.trim()) {
      setError(t('notExecuted.reasonRequired'));
      return;
    }
    reportNonExecution({ order_id: orderId, reporter_role: role, reason: reason.trim() });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
        <View style={styles.successWrap}>
          <Ionicons name="checkmark-circle" size={76} color={scheme.success} />
          <Text style={[styles.title, { color: scheme.text }]}>{t('notExecuted.successTitle')}</Text>
          <Text style={[styles.body, { color: scheme.textSecondary }]}>
            {role === 'provider' ? t('notExecuted.successProvider') : t('notExecuted.successCustomer')}
          </Text>
          <AppButton title={t('notExecuted.backToOrders')} variant="primary" size="lg" onPress={() => router.replace('/(drawer)/(tabs)/orders')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]} edges={['top']}>
      <View style={styles.header}>
        <AppButton title={t('common.back')} variant="ghost" size="sm" onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: scheme.text }]}>{t('notExecuted.title')}</Text>
        <View style={{ width: 64 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.warning, { backgroundColor: `${scheme.warning}15` }]}>
          <Ionicons name="alert-circle-outline" size={24} color={scheme.warning} />
          <Text style={[styles.warningText, { color: scheme.text }]}>{t('notExecuted.subtitle')}</Text>
        </View>
        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.label, { color: scheme.textSecondary }]}>{t('notExecuted.orderLabel')}</Text>
          <Text style={[styles.value, { color: scheme.text }]}>{order?.description ?? orderId}</Text>
          <View style={[styles.divider, { backgroundColor: scheme.border }]} />
          <Text style={[styles.label, { color: scheme.textSecondary }]}>{t('notExecuted.providerLabel')}</Text>
          <Text style={[styles.value, { color: scheme.text }]}>{providerName}</Text>
        </AppCard>
        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.label, { color: scheme.text }]}>{t('notExecuted.roleLabel')}</Text>
          <View style={styles.roles}>
            {(['customer', 'provider'] as NonExecutionReporter[]).map((item) => {
              const selected = role === item;
              return (
                <AppButton
                  key={item}
                  title={item === 'customer' ? t('notExecuted.customerRole') : t('notExecuted.providerRole')}
                  variant={selected ? 'primary' : 'secondary'}
                  size="md"
                  onPress={() => setRole(item)}
                />
              );
            })}
          </View>
          <Text style={[styles.hint, { color: scheme.textSecondary }]}>
            {role === 'provider' ? t('notExecuted.providerHint') : t('notExecuted.customerHint')}
          </Text>
        </AppCard>
        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.label, { color: scheme.text }]}>{t('notExecuted.reasonLabel')}</Text>
          <AppTextInput
            placeholder={t('notExecuted.reasonPlaceholder')}
            value={reason}
            onChangeText={(value) => { setReason(value); setError(null); }}
            error={error}
            multiline
            numberOfLines={6}
            style={{ minHeight: 140, textAlignVertical: 'top' }}
          />
        </AppCard>
        <AppButton title={t('notExecuted.submitBtn')} variant="danger" size="lg" onPress={submit} leadingIcon={<Ionicons name="flag-outline" size={20} color={scheme.dangerContrast} />} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: 1 },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, writingDirection: 'rtl' },
  content: { padding: Spacing.six, gap: Spacing.four },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, padding: Spacing.four, borderRadius: Radii.lg },
  warningText: { flex: 1, fontSize: FontSizes.sm, lineHeight: FontSizes.base + 4, writingDirection: 'rtl', textAlign: 'right' },
  card: { gap: Spacing.two },
  label: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, writingDirection: 'rtl', textAlign: 'right' },
  value: { fontSize: FontSizes.base, writingDirection: 'rtl', textAlign: 'right' },
  divider: { height: 1, marginVertical: Spacing.two },
  roles: { flexDirection: 'row', gap: Spacing.two },
  hint: { fontSize: FontSizes.sm, lineHeight: FontSizes.base + 4, writingDirection: 'rtl', textAlign: 'right' },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.six, gap: Spacing.three },
  title: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, textAlign: 'center', writingDirection: 'rtl' },
  body: { fontSize: FontSizes.base, textAlign: 'center', writingDirection: 'rtl', lineHeight: FontSizes.lg + 4, marginBottom: Spacing.three },
});
