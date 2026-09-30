// ===============================================================
// شرح الملف: هذا صفحة إنشاء طلب خدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: needsClarification، CreateOrderScreen، handleSubmit، proceed، handleClarificationConfirm، handleClarificationCancel.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة إنشاء طلب جديد
// ═══════════════════════════════════════════════════════════

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
  const { startOrder, hasAcceptedDisclaimer } = useOrder();

  const [description, setDescription] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClarification, setShowClarification] = useState(false);
  const [submitting, setSubmitting] = useState(false);

// [شرح الدالة: handleSubmit] يعالج إرسال النموذج الحالي بعد التحقق من البيانات وتنفيذ العملية المطلوبة.
  const handleSubmit = () => {
    if (submitting) return;
    setError(null);

    const trimmed = description.trim();
    const trimmedServiceArea = serviceArea.trim();
    if (!trimmed) {
      setError(t('orders.create.required'));
      return;
    }
    if (!trimmedServiceArea) {
      setError('يرجى كتابة مكان تقديم الخدمة.');
      return;
    }

    // ⭐ إخلاء المسؤولية أول مرة
    if (!hasAcceptedDisclaimer) {
      router.push({
        pathname: '/orders/disclaimer',
        params: {
          description: trimmed,
          is_urgent: isUrgent.toString(),
          region_id: user?.region?.id ?? 'r-damascus',
        },
      });
      return;
    }

    // 🤔 فحص الغموض
    if (needsClarification(trimmed)) {
      setShowClarification(true);
      return;
    }

    proceed(trimmed);
  };

// [شرح الدالة: proceed] ينفذ الانتقال إلى الخطوة التالية بعد فحص بيانات الطلب.
  const proceed = async (trimmed: string) => {
    setSubmitting(true);
    setError(null);

    try {
      // قاعدة البيانات يجب أن تؤكد إنشاء الطلب قبل الانتقال إلى البحث.
      const order = await startOrder({
        description: trimmed,
        is_urgent: isUrgent,
        region_id: user?.region?.id ?? 'r-damascus',
        service_area: serviceArea.trim(),
        additional_info: additionalInfo.trim(),
      });

      setSubmitting(false);

      router.push({
        pathname: '/orders/searching',
        params: {
          description: order.description,
          is_urgent: order.is_urgent.toString(),
          request_id: order.id,
        },
      });
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'تعذر إنشاء طلب الخدمة. حاول مرة أخرى.');
    }
  };

// [شرح الدالة: handleClarificationConfirm] يعالج تأكيد المستخدم على طلب التوضيح ويكمل سير إنشاء الطلب.
  const handleClarificationConfirm = () => {
    setShowClarification(false);
    proceed(description.trim());
  };

// [شرح الدالة: handleClarificationCancel] يلغي طلب التوضيح ويعود إلى مسار إنشاء الطلب.
  const handleClarificationCancel = () => {
    setShowClarification(false);
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

            <Text style={[styles.fieldLabel, { color: scheme.text }]}>وين بدك الخدمة؟</Text>
            <AppTextInput
              placeholder="مثال: اللاذقية، أو اللاذقية المشروع السابع"
              value={serviceArea}
              onChangeText={(val) => {
                setServiceArea(val);
                setError(null);
              }}
              error={error && !description.trim() ? error : undefined}
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
    </SafeAreaView>
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