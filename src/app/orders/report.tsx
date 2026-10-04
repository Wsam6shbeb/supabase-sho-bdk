// ===============================================================
// شرح الملف: هذا صفحة الإبلاغ عن مشكلة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ReportScreen، handleSubmit.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة الإبلاغ عن مشكلة
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: ReportScreen] يعرض نموذج الإبلاغ عن مشكلة مرتبطة بالطلب أو مقدم الخدمة.
export default function ReportScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams();
  const { submitReport } = useOrder();

  const reportedUserId = (params.reported_user_id as string) ?? '';
  const reportedUserName = (params.reported_user_name as string) ?? 'مستخدم';
  const orderId = (params.order_id as string) ?? null;

  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

// [شرح الدالة: handleSubmit] يعالج إرسال النموذج الحالي بعد التحقق من البيانات وتنفيذ العملية المطلوبة.
  const handleSubmit = async () => {
    setError(null);

    if (!description.trim()) {
      setError(t('reports.descriptionRequired'));
      return;
    }

    setSubmitting(true);
    const result = await submitReport({
      reported_user_id: reportedUserId,
      reported_user_name: reportedUserName,
      order_id: orderId,
      category: 'other', // تصنيف داخلي فقط؛ المستخدم يشرح المشكلة بحرية في النص.
      description: description.trim(),
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? 'تعذر إرسال البلاغ. حاول مرة أخرى.');
      return;
    }

    setSubmitted(true);
  };

  // ═══════════════════════════════════════════════════════════
  // شاشة النجاح
  // ═══════════════════════════════════════════════════════════
  if (submitted) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: scheme.background }]}
        edges={['top']}
      >
        <View style={styles.successWrap}>
          <View
            style={[styles.successIcon, { backgroundColor: `${scheme.success}15` }]}
          >
            <Ionicons name="checkmark-circle" size={80} color={scheme.success} />
          </View>
          <Text style={[styles.successTitle, { color: scheme.text }]}>
            {t('reports.successTitle')}
          </Text>
          <Text style={[styles.successBody, { color: scheme.textSecondary }]}>
            {t('reports.successBody')}
          </Text>
          <AppButton
            title={t('reports.backBtn')}
            variant="primary"
            size="lg"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.six, width: '100%' }}
            leadingIcon={
              <Ionicons name="arrow-back" size={18} color={scheme.primaryContrast} />
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // النموذج
  // ═══════════════════════════════════════════════════════════
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={26} color={scheme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: scheme.text }]}>
            {t('reports.title')}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Reported User */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <View style={styles.reportedUserRow}>
              <View
                style={[
                  styles.reportedAvatar,
                  { backgroundColor: `${scheme.danger}15` },
                ]}
              >
                <Ionicons name="person" size={24} color={scheme.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reportedLabel, { color: scheme.textSecondary }]}>
                  {t('reports.reportedUser')}
                </Text>
                <Text style={[styles.reportedName, { color: scheme.text }]}>
                  {reportedUserName}
                </Text>
              </View>
            </View>
          </AppCard>

          {/* Description */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <Text style={[styles.sectionLabel, { color: scheme.text }]}>
              {t('reports.descriptionLabel')}
            </Text>
            <AppTextInput
              placeholder={t('reports.descriptionPlaceholder')}
              value={description}
              onChangeText={(v) => {
                setDescription(v);
                setError(null);
              }}
              error={error}
              multiline
              numberOfLines={5}
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />
          </AppCard>
        </ScrollView>

        {/* Submit */}
        <View style={styles.footer}>
          <AppButton
            title={t('reports.submitBtn')}
            variant="danger"
            size="lg"
            onPress={handleSubmit}
            leadingIcon={
              <Ionicons name="flag" size={20} color={scheme.dangerContrast} />
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  card: {
    marginBottom: Spacing.three,
  },
  reportedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  reportedAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportedLabel: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  reportedName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  sectionLabel: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
    marginBottom: Spacing.three,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.two,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  successIcon: {
    width: 140,
    height: 140,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.five,
  },
  successTitle: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  successBody: {
    fontSize: FontSizes.base,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: FontSizes.lg + 4,
  },
});