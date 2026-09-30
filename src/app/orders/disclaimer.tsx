// ===============================================================
// شرح الملف: هذا صفحة الموافقة على التنبيه/الشروط قبل المتابعة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: DisclaimerScreen، handleAccept، handleCancel.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة إخلاء المسؤولية
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: DisclaimerScreen] يعرض التنبيه أو الإقرار المطلوب قبل متابعة إنشاء الطلب.
export default function DisclaimerScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { acceptDisclaimer, startOrder } = useOrder();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

// [شرح الدالة: handleAccept] يسجل موافقة المستخدم على التنبيه وينتقل إلى الخطوة التالية.
  const handleAccept = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    acceptDisclaimer();

    // إذا وصلنا من شاشة إنشاء الطلب، نكمل الطلب مباشرة بدل إعادة المستخدم
    // إلى نفس النموذج. هذا يلغي خطوة إضافية غير ضرورية في التدفق.
    const description = typeof params.description === 'string' ? params.description.trim() : '';
    if (description) {
      const isUrgent = params.is_urgent === 'true';
      try {
        const order = await startOrder({
          description,
          is_urgent: isUrgent,
          region_id: typeof params.region_id === 'string'
            ? params.region_id
            : (user?.region.id ?? 'r-damascus'),
          service_area: typeof params.service_area === 'string' ? params.service_area.trim() : '',
          additional_info: typeof params.additional_info === 'string' ? params.additional_info.trim() : '',
        });

        router.replace({
        pathname: '/orders/searching',
        params: {
          description: order.description,
          is_urgent: order.is_urgent.toString(),
          request_id: order.id,
        },
        });
        return;
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الطلب. حاول مرة أخرى.',
        );
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
    router.back();
  };

// [شرح الدالة: handleCancel] يلغي العملية الحالية أو يعيد المستخدم إلى الخطوة السابقة.
  const handleCancel = () => {
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top', 'bottom']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Icon */}
        <View style={styles.iconSection}>
          <View
            style={[styles.iconCircle, { backgroundColor: `${scheme.warning}15` }]}
          >
            <Ionicons name="warning" size={48} color={scheme.warning} />
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: scheme.text }]}>
          {t('disclaimer.title')}
        </Text>

        {/* Body */}
        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.body, { color: scheme.textSecondary }]}>
            {t('disclaimer.body')}
          </Text>
        </AppCard>

        {errorMessage ? (
          <View style={[styles.errorBox, { borderColor: scheme.error, backgroundColor: scheme.error + '15' }]}>
            <Ionicons name="alert-circle" size={22} color={scheme.error} />
            <Text style={[styles.errorText, { color: scheme.error }]}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <AppButton
            title={isSubmitting ? 'جارٍ المتابعة...' : t('disclaimer.acceptBtn')}
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            onPress={() => { void handleAccept(); }}
            leadingIcon={
              <Ionicons name="checkmark-circle" size={20} color={scheme.primaryContrast} />
            }
          />
          <AppButton
            title={t('disclaimer.cancelBtn')}
            variant="secondary"
            size="lg"
            onPress={handleCancel}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.six,
    paddingBottom: Spacing.eight,
  },
  iconSection: {
    alignItems: 'center',
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.five,
  },
  card: {
    marginBottom: Spacing.five,
  },
  body: {
    fontSize: FontSizes.base,
    lineHeight: FontSizes.lg + 6,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  actions: {
    gap: Spacing.three,
  },
});