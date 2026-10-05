// ===============================================================
// شرح الملف: هذا صفحة إعادة طلب الخدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: RequestAgainScreen، handleSubmit.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة طلب الخدمة مرة أخرى
// ═══════════════════════════════════════════════════════════

import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { api } from '@/services/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: RequestAgainScreen] يعرض واجهة إعادة إرسال/تكرار طلب خدمة سابق.
export default function RequestAgainScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams();
  const { requestProviderAgain, isProviderBlocked, hasAcceptedDisclaimer } = useOrder();

  const providerId = params.provider_id as string;
  const provider = api.providers.getProviderById(providerId);

  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Guard
  if (!provider) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle" size={64} color={scheme.danger} />
          <Text style={[styles.errorText, { color: scheme.text }]}>
            مقدم الخدمة غير موجود
          </Text>
          <AppButton
            title={t('common.back')}
            variant="primary"
            size="md"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const blocked = isProviderBlocked(providerId);

// [شرح الدالة: handleSubmit] يعالج إرسال النموذج الحالي بعد التحقق من البيانات وتنفيذ العملية المطلوبة.
  const handleSubmit = () => {
    setError(null);

    if (blocked) {
      setError(t('requestAgain.blockedProvider'));
      return;
    }

    const trimmed = description.trim();
    if (!trimmed) {
      setError(t('requestAgain.descriptionRequired'));
      return;
    }

    // إخلاء المسؤولية
    if (!hasAcceptedDisclaimer) {
      router.push('/orders/disclaimer');
      return;
    }

    const order = requestProviderAgain(provider, trimmed);

    router.replace({
      pathname: '/orders/chat',
      params: { provider_id: provider.id, from_again: 'true', order_id: order.id },
    });
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={26} color={scheme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: scheme.text }]}>
            {t('requestAgain.title')}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Provider Card */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <View style={styles.providerRow}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: `${provider.card_color}30` },
                ]}
              >
                <Text style={[styles.avatarText, { color: provider.card_color }]}>
                  {provider.name.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.providerName, { color: scheme.text }]}>
                  {provider.name}
                </Text>
                <Text style={[styles.providerMeta, { color: scheme.textSecondary }]}>
                  {provider.region.name_ar} • ⭐ {provider.rating}
                </Text>
              </View>
            </View>
          </AppCard>

          {/* Description */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <Text style={[styles.sectionLabel, { color: scheme.text }]}>
              {t('requestAgain.descriptionLabel')}
            </Text>
            <AppTextInput
              placeholder={t('requestAgain.descriptionPlaceholder')}
              value={description}
              onChangeText={(v) => {
                setDescription(v);
                setError(null);
              }}
              error={error}
              multiline
              numberOfLines={4}
              containerStyle={{ minHeight: 100 }}
            />
          </AppCard>
        </ScrollView>

        {/* Submit */}
        <View style={styles.footer}>
          <AppButton
            title={t('requestAgain.submitBtn')}
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            disabled={blocked}
            leadingIcon={
              <Ionicons
                name="refresh-circle"
                size={20}
                color={scheme.primaryContrast}
              />
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
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
  },
  providerName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  providerMeta: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
  },
  sectionLabel: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
    marginBottom: Spacing.three,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.two,
  },
  errorWrap: {
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