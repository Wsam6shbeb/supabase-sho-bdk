// ===============================================================
// شرح الملف: هذا صفحة تقديم/عرض خدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: BecomeProviderScreen، handleSubmit.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة صير مقدم خدمة
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
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

// [شرح الدالة: BecomeProviderScreen] يعرض نموذج إضافة ملف مقدم خدمة والمهارة التي يقدمها المستخدم.
export default function BecomeProviderScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { addFirstSkill } = useOrder();

  const [skillName, setSkillName] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

// [شرح الدالة: handleSubmit] يعالج إرسال النموذج الحالي بعد التحقق من البيانات وتنفيذ العملية المطلوبة.
  const handleSubmit = async () => {
    setError(null);
    const trimmed = skillName.trim();
    const trimmedArea = serviceArea.trim();

    if (!trimmed) {
      setError(t('home.becomeProvider.requiredSkillName'));
      return;
    }

    if (!trimmedArea) {
      setError('اكتب مكان تقديم الخدمة. مثال: المشروع السابع، أو اللاذقية مدينة وريف.');
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    const result = await addFirstSkill({
      id: `skill_${Date.now()}`,
      name: trimmed,
      service_area: trimmedArea,
      additional_info: additionalInfo.trim(),
    });

    setSubmitting(false);
    if (result.clarificationQuestion) {
      setError(result.clarificationQuestion);
      return;
    }

    // إذا استلم مكافأة → شاشة المكافأة، وإلا → الرئيسية
    if (result.welcomeBonus) {
      router.replace('/orders/welcome-bonus');
    } else {
      router.replace('/(drawer)/(tabs)');
    }
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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="close" size={26} color={scheme.text} />
            </Pressable>
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <View
              style={[styles.iconCircle, { backgroundColor: `${scheme.primary}15` }]}
            >
              <Ionicons name="construct" size={40} color={scheme.primary} />
            </View>
            <Text style={[styles.title, { color: scheme.text }]}>
              {t('home.becomeProvider.title')}
            </Text>
            <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
              {t('home.becomeProvider.subtitle')}
            </Text>
          </View>

          {/* الخدمة ومكان تقديمها والمعلومات الإضافية */}
          <AppCard padding="four" elevation="sm">
            <View style={[styles.instructionBanner, { backgroundColor: `${scheme.primary}10`, borderColor: `${scheme.primary}35` }]}>
              <Ionicons name="sparkles-outline" size={22} color={scheme.primary} />
              <Text style={[styles.instructionText, { color: scheme.text }]}>
                اكتب أي شي أنت تتقنه (مصالح-تدريس-تعليم سواقة-تعقيب معاملات...) ليتمكن الناس من الوصول إليك
              </Text>
            </View>

            <AppTextInput
              label="ما المهارة أو الخدمة التي تتقنها؟"
              placeholder="مثال: معلم طاقة شمسية"
              value={skillName}
              onChangeText={(v) => {
                setSkillName(v);
                setError(null);
              }}
              error={error}
              required
              containerStyle={styles.serviceInput}
            />

            <AppTextInput
              label="أين تقدم هذه الخدمة؟"
              placeholder="مثال: المشروع السابع، أو اللاذقية مدينة وريف"
              value={serviceArea}
              onChangeText={(v) => {
                setServiceArea(v);
                setError(null);
              }}
              required
              containerStyle={styles.serviceInput}
            />

            <AppTextInput
              label="معلومات إضافية (اختياري)"
              placeholder="مثال: بجي لعند الزبون، تركيب وصيانة، خبرة 10 سنوات..."
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              multiline
              numberOfLines={3}
              containerStyle={styles.serviceInput}
            />
          </AppCard>

          {/* Actions */}
          <View style={styles.actions}>
            <AppButton
              title={t('home.becomeProvider.submitBtn')}
              variant="primary"
              size="lg"
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
              leadingIcon={
                <Ionicons name="checkmark-circle" size={20} color={scheme.primaryContrast} />
              }
            />
            <AppButton
              title={t('common.cancel')}
              variant="secondary"
              size="lg"
              onPress={() => router.back()}
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
    paddingBottom: Spacing.eight,
  },
  header: {
    marginBottom: Spacing.four,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: Spacing.six,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  subtitle: {
    fontSize: FontSizes.base,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingHorizontal: Spacing.four,
  },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  instructionText: {
    flex: 1,
    fontSize: FontSizes.base,
    lineHeight: FontSizes.lg + 3,
    fontWeight: FontWeights.semibold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  serviceInput: {
    minHeight: 150,
  },
  actions: {
    gap: Spacing.three,
    marginTop: Spacing.six,
  },
});