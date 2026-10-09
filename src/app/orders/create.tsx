// ===============================================================
// شرح الملف: هذا صفحة إنشاء طلب خدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: needsClarification، CreateOrderScreen، handleSubmit، proceed، handleClarificationConfirm، handleClarificationCancel.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة إنشاء طلب جديد
// ═══════════════════════════════════════════════════════════

import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import {
    Colors,
    FontSizes,
    FontWeights,
    Radii,
    Spacing,
} from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import type { ServiceRequestAnalysis } from '@/context/OrderContext';
import {
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const VAGUE_KEYWORDS = ['شي', 'شيء', 'مشكلة', 'خدمة', 'مساعده', 'مساعدة', 'بدي'];

// [شرح الدالة: needsClarification] يتحقق مما إذا كان وصف الطلب يحتاج إلى توضيح قبل المتابعة.
function needsClarification(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 15) return true;
  const lower = trimmed.toLowerCase();
  if (VAGUE_KEYWORDS.some((kw) => lower === kw)) return true;
  return false;
}

// [شرح الدالة: CreateOrderScreen] يعرض نموذج إنشاء طلب خدمة جديد.
export default function CreateOrderScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user } = useAuth();
  const { startOrder, analyzeOrderRequest, hasAcceptedDisclaimer } = useOrder();

  const [description, setDescription] = useState('');
  const [city, setCity] = useState(user?.region?.id ?? '');
  const [serviceArea, setServiceArea] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClarification, setShowClarification] = useState(false);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [clarificationAttempts, setClarificationAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

// [شرح الدالة: handleSubmit] يعالج إرسال النموذج الحالي بعد التحقق من البيانات وتنفيذ العملية المطلوبة.
  const analyzeAndContinue = async (answer = '') => {
    if (submitting) return;
    const original = description.trim();
    const finalDescription = answer.trim()
      ? `${original}\nتوضيح المستخدم: ${answer.trim()}`
      : original;
    const area = [city.trim(), serviceArea.trim()].filter(Boolean).join(' - ');
    setSubmitting(true);
    setError(null);
    try {
      const analysis = await analyzeOrderRequest({
        description: finalDescription,
        service_area: area,
        additional_info: additionalInfo.trim(),
      });
      if (!analysis) {
        setError('تعذّر تحليل الطلب حالياً. لم ننشئ الطلب بعد؛ حاول مرة أخرى.');
        return;
      }
      if (analysis.needs_clarification) {
        if (clarificationAttempts >= 2) {
          setShowClarification(false);
          setError('ما زال الطلب غير واضح. عدّل الوصف وأضف نوع الخدمة أو المطلوب الأساسي.');
          return;
        }
        setClarificationAttempts((count) => count + 1);
        setClarificationQuestion(analysis.clarification_question || 'ممكن توضح أكثر شو الخدمة التي تحتاجها تحديداً؟');
        setClarificationAnswer('');
        setShowClarification(true);
        return;
      }
      setShowClarification(false);
      await proceed(finalDescription, analysis);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (submitting) return;
    setError(null);
    const trimmed = description.trim();
    const trimmedCity = city.trim();
    if (!trimmed) {
      setError(t('orders.create.required'));
      return;
    }
    if (!trimmedCity) {
      setError('يرجى كتابة المدينة.');
      return;
    }
    if (!hasAcceptedDisclaimer) {
      router.push({
        pathname: '/orders/disclaimer',
        params: {
          description: trimmed,
          is_urgent: isUrgent.toString(),
          region_id: trimmedCity,
          service_area: serviceArea.trim(),
          additional_info: additionalInfo.trim(),
        },
      });
      return;
    }
    void analyzeAndContinue(clarificationAnswer);
  };

  const proceed = async (trimmed: string, analysis: ServiceRequestAnalysis) => {
    setError(null);
    const area = [city.trim(), serviceArea.trim()].filter(Boolean).join(' - ');
    try {
      const order = await startOrder({
        description: trimmed,
        is_urgent: isUrgent,
        region_id: city.trim(),
        service_area: area,
        additional_info: additionalInfo.trim(),
        analysis,
      });
      router.push({
        pathname: '/orders/searching',
        params: {
          description: order.description,
          is_urgent: order.is_urgent.toString(),
          request_id: order.id,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء طلب الخدمة. حاول مرة أخرى.');
    }
  };

  const handleClarificationConfirm = () => {
    if (!clarificationAnswer.trim()) {
      setError('جاوب على سؤال التوضيح قبل المتابعة.');
      return;
    }
    void analyzeAndContinue(clarificationAnswer);
  };

  const handleClarificationCancel = () => {
    setShowClarification(false);
    setClarificationAnswer('');
  };

  return (
    <ScreenSafeArea
      style={[styles.safe, { backgroundColor: scheme.background }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={[styles.backText, { color: scheme.primary }]}>← رجوع</Text>
            </Pressable>
          </View>

          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: scheme.text }]}>
              {t('orders.create.title')}
            </Text>
            <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
              {t('orders.create.subtitle')}
            </Text>
          </View>

          <AppCard padding="four" elevation="sm">
            <Text style={[styles.fieldLabel, { color: scheme.text }]}>شو الخدمة اللي بدك ياها؟</Text>
            <AppTextInput
              placeholder="مثال: بدي معقب معاملات"
              value={description}
              onChangeText={(val) => {
                setDescription(val);
                setError(null);
              }}
              multiline
              numberOfLines={4}
              containerStyle={styles.textInput}
            />

            <Text style={[styles.fieldLabel, { color: scheme.text }]}>بأي مدينة بدك الخدمة؟</Text>
            <AppTextInput
              placeholder="مثال: اللاذقية"
              value={city}
              onChangeText={(val) => {
                setCity(val);
                setError(null);
              }}
              containerStyle={styles.areaInput}
            />

            <Text style={[styles.fieldLabel, { color: scheme.text }]}>بأي منطقة؟ (اختياري)</Text>
            <AppTextInput
              placeholder="مثال: المشروع السابع"
              value={serviceArea}
              onChangeText={(val) => {
                setServiceArea(val);
                setError(null);
              }}
              error={error}
              containerStyle={styles.areaInput}
            />

            <Text style={[styles.fieldLabel, { color: scheme.text }]}>معلومات إضافية (اختياري)</Text>
            <AppTextInput
              placeholder="مثال: بدي متابعة معاملة تسجيل عقار"
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              multiline
              numberOfLines={3}
              containerStyle={styles.additionalInput}
            />

            <Pressable
              onPress={() => setIsUrgent(!isUrgent)}
              style={({ pressed }) => [
                styles.urgentToggle,
                {
                  backgroundColor: isUrgent
                    ? `${scheme.urgent}15`
                    : scheme.backgroundElement,
                  borderColor: isUrgent ? scheme.urgent : scheme.border,
                  borderWidth: isUrgent ? 2 : 1,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={styles.urgentContent}>
                <Ionicons
                  name={isUrgent ? 'flash' : 'flash-outline'}
                  size={20}
                  color={isUrgent ? scheme.urgent : scheme.textSecondary}
                />
                <View style={styles.urgentTextContainer}>
                  <Text style={[styles.urgentTitle, { color: scheme.text }]}>
                    {t('orders.create.urgentToggle')}
                  </Text>
                </View>
                {isUrgent && (
                  <View
                    style={[styles.urgentBadge, { backgroundColor: scheme.urgent }]}
                  >
                    <Text
                      style={[styles.urgentBadgeText, { color: scheme.urgentContrast }]}
                    >
                      ⚡
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </AppCard>

          {showClarification && (
            <AppCard padding="four" elevation="md" style={styles.clarificationCard}>
              <View style={styles.clarificationHeader}>
                <Ionicons name="help-circle" size={24} color={scheme.primary} />
                <Text style={[styles.clarificationTitle, { color: scheme.text }]}>
                  {t('orders.create.clarificationTitle')}
                </Text>
              </View>
              <Text
                style={[styles.clarificationBody, { color: scheme.textSecondary }]}
              >
                {t('orders.create.clarificationBody')}
              </Text>
              <View style={styles.clarificationActions}>
                <AppButton
                  title="تعديل الطلب"
                  variant="secondary"
                  size="md"
                  onPress={handleClarificationCancel}
                  fullWidth={false}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="متابعة على أي حال"
                  variant="primary"
                  size="md"
                  onPress={handleClarificationConfirm}
                  fullWidth={false}
                  style={{ flex: 1, marginStart: Spacing.two }}
                />
              </View>
            </AppCard>
          )}

          <View style={styles.actions}>
            <AppButton
              title={t('orders.create.submitBtn')}
              variant="primary"
              size="lg"
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
            />
            <AppButton
              title={t('orders.create.cancelBtn')}
              variant="secondary"
              size="lg"
              onPress={() => router.back()}
              disabled={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.six,
    paddingTop: Spacing.six,
    flexGrow: 1,
  },
  header: {
    marginBottom: Spacing.four,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
  },
  titleSection: {
    marginBottom: Spacing.six,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.two,
  },
  subtitle: {
    fontSize: FontSizes.base,
    lineHeight: FontSizes.lg + 2,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.two,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  textInput: {
    minHeight: 150,
    maxHeight: 240,
    textAlignVertical: 'top',
    marginBottom: Spacing.four,
  },
  areaInput: {
    marginBottom: Spacing.four,
  },
  additionalInput: {
    minHeight: 90,
    maxHeight: 150,
    textAlignVertical: 'top',
  },
  urgentToggle: {
    alignSelf: 'flex-start',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.three,
    minHeight: 44,
  },
  urgentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  urgentTextContainer: {
    flexShrink: 1,
  },
  urgentTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  urgentDescription: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.base + 2,
  },
  urgentBadge: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentBadgeText: {
    fontSize: FontSizes.lg,
  },
  clarificationCard: {
    marginTop: Spacing.four,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  clarificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  clarificationTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  clarificationBody: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.base + 4,
    writingDirection: 'rtl',
    textAlign: 'right',
    marginBottom: Spacing.four,
  },
  clarificationActions: {
    flexDirection: 'row',
  },
  actions: {
    gap: Spacing.three,
    marginTop: Spacing.six,
  },
});