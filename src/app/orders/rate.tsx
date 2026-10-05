// ===============================================================
// شرح الملف: هذا صفحة تقييم الخدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: RateOrderScreen، toggleTag، handleSubmit.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة تقييم الخدمة
// ═══════════════════════════════════════════════════════════

import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { RatingStars } from '@/components/orders/RatingStars';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { useAuth } from '@/hooks/use-auth';
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
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

// ⭐ الصفات الجاهزة
const RATING_TAGS: { id: string; label: string }[] = [
  { id: 'onTime', label: 'ملتزم بالموعد' },
  { id: 'respectful', label: 'محترم' },
  { id: 'greatWork', label: 'عمله ممتاز' },
  { id: 'fairPrice', label: 'سعره مناسب' },
  { id: 'fastResponse', label: 'سريع الاستجابة' },
];

// [شرح الدالة: RateOrderScreen] يعرض واجهة تقييم الطلب بعد انتهاء الخدمة.
export default function RateOrderScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams();
  const { getOrderById, rateOrder, orderHistory } = useOrder();
  const { user } = useAuth();
  const orderId = params.order_id as string;
  const readonly = params.readonly === 'true';
  const order = getOrderById(orderId) ?? orderHistory.find((o) => o.id === orderId);

  const [stars, setStars] = useState(order?.customer_rating ?? 0);
  const [comment, setComment] = useState(order?.customer_comment ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(order?.customer_tags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // Guard
  // ═══════════════════════════════════════════════════════════
  if (!order) {
    return (
      <ScreenSafeArea
        style={[styles.safe, { backgroundColor: scheme.background }]}
      >
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle" size={64} color={scheme.danger} />
          <Text style={[styles.errorText, { color: scheme.text }]}>
            الطلب غير موجود
          </Text>
          <AppButton
            title={t('common.back')}
            variant="primary"
            size="md"
            onPress={() => router.back()}
          />
        </View>
      </ScreenSafeArea>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Toggle tag
  // ═══════════════════════════════════════════════════════════
// [شرح الدالة: toggleTag] يضيف أو يزيل وسمًا من قائمة ملاحظات التقييم.
  const toggleTag = (tagId: string) => {
    if (readonly) return;
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  };

  // ═══════════════════════════════════════════════════════════
  // Submit
  // ═══════════════════════════════════════════════════════════
// [شرح الدالة: handleSubmit] يعالج إرسال النموذج الحالي بعد التحقق من البيانات وتنفيذ العملية المطلوبة.
   const handleSubmit = async () => {
    setError(null);

    if (stars === 0) {
      setError(t('orders.myOrders.rating.starsRequired'));
      return;
    }

    if (!user?.id) {
      setError('يجب تسجيل الدخول');
      return;
    }

    // التقييم يُحفظ في السيرفر (هو الذي يغلق الطلب ويحدّث سمعة مقدم الخدمة)
    setSubmitting(true);
    const result = await rateOrder({
      order_id: orderId,
      stars,
      comment: comment.trim() || undefined,
      tags: selectedTags,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? 'فشل حفظ التقييم. حاول مرة أخرى.');
      return;
    }

    setSubmitted(true);
  };

  // ═══════════════════════════════════════════════════════════
  // شاشة النجاح
  // ═══════════════════════════════════════════════════════════
  if (submitted) {
    return (
      <ScreenSafeArea
        style={[styles.safe, { backgroundColor: scheme.background }]}
      >
        <View style={styles.successWrap}>
          <View
            style={[
              styles.successIcon,
              { backgroundColor: `${scheme.success}15` },
            ]}
          >
            <Ionicons name="checkmark-circle" size={80} color={scheme.success} />
          </View>
          <Text style={[styles.successTitle, { color: scheme.text }]}>
            {t('orders.myOrders.rating.successTitle')}
          </Text>
          <Text style={[styles.successBody, { color: scheme.textSecondary }]}>
            {t('orders.myOrders.rating.successBody')}
          </Text>
          <AppButton
            title={t('orders.myOrders.rating.backToOrders')}
            variant="primary"
            size="lg"
            onPress={() => router.replace('/(drawer)/(tabs)/orders')}
            style={{ marginTop: Spacing.six, width: '100%' }}
            leadingIcon={
              <Ionicons name="arrow-back" size={18} color={scheme.primaryContrast} />
            }
          />
        </View>
      </ScreenSafeArea>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // شاشة العرض (readonly)
  // ═══════════════════════════════════════════════════════════
  const isReadonly = readonly || !!order.customer_rating;

  return (
    <ScreenSafeArea
      style={[styles.safe, { backgroundColor: scheme.background }]}
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
            {isReadonly
              ? t('orders.myOrders.actions.viewDetails')
              : t('orders.myOrders.rating.title')}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* ترحيب */}
          <View style={styles.introSection}>
            <View
              style={[styles.providerAvatar, { backgroundColor: `${scheme.primary}20` }]}
            >
              <Text style={[styles.providerAvatarText, { color: scheme.primary }]}>
                {order.provider_name?.charAt(0) ?? '؟'}
              </Text>
            </View>
            <Text style={[styles.introTitle, { color: scheme.text }]}>
              {isReadonly
                ? `تقييمك لـ ${order.provider_name ?? 'مقدم الخدمة'}`
                : t('orders.myOrders.rating.subtitle', {
                    name: order.provider_name ?? 'مقدم الخدمة',
                  })}
            </Text>
            <Text style={[styles.introDescription, { color: scheme.textSecondary }]}>
              {order.description}
            </Text>
          </View>

          {/* النجوم */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <Text style={[styles.sectionLabel, { color: scheme.text }]}>
              {isReadonly ? 'التقييم' : 'قيّم الخدمة'}
            </Text>
            <View style={styles.starsWrap}>
              <RatingStars
                value={stars}
                onChange={isReadonly ? undefined : setStars}
                readonly={isReadonly}
                size={40}
                showLabel
              />
            </View>
            {error && (
              <Text style={[styles.errorText, { color: scheme.danger }]}>
                {error}
              </Text>
            )}
          </AppCard>

          {/* الصفات الجاهزة */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <Text style={[styles.sectionLabel, { color: scheme.text }]}>
              {t('orders.myOrders.rating.tagsLabel')}
            </Text>
            <View style={styles.tagsWrap}>
              {RATING_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => toggleTag(tag.id)}
                    disabled={isReadonly}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: selected
                          ? `${scheme.primary}15`
                          : scheme.backgroundElement,
                        borderColor: selected ? scheme.primary : scheme.border,
                      },
                    ]}
                  >
                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={scheme.primary}
                      />
                    )}
                    <Text
                      style={[
                        styles.tagChipText,
                        { color: selected ? scheme.primary : scheme.textSecondary },
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </AppCard>

          {/* التعليق */}
          <AppCard padding="four" elevation="sm" style={styles.card}>
            <Text style={[styles.sectionLabel, { color: scheme.text }]}>
              {t('orders.myOrders.rating.commentLabel')}
            </Text>
            <AppTextInput
              placeholder={t('orders.myOrders.rating.commentPlaceholder')}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              editable={!isReadonly}
              containerStyle={{ minHeight: 80 }}
            />
          </AppCard>
        </ScrollView>

        {/* Submit */}
        {!isReadonly && (
          <View style={styles.footer}>
            <AppButton
              title={t('orders.myOrders.rating.submitBtn')}
              variant="primary"
              size="lg"
              onPress={() => { void handleSubmit(); }}
              loading={submitting}
              disabled={submitting}
              leadingIcon={
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={scheme.primaryContrast}
                />
              }
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenSafeArea>
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
  introSection: {
    alignItems: 'center',
    marginBottom: Spacing.five,
    paddingTop: Spacing.three,
  },
  providerAvatar: {
    width: 80,
    height: 80,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  providerAvatarText: {
    fontSize: FontSizes['3xl'],
    fontWeight: FontWeights.bold,
  },
  introTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  introDescription: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingHorizontal: Spacing.four,
  },
  card: {
    marginBottom: Spacing.three,
  },
  sectionLabel: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
    marginBottom: Spacing.three,
  },
  starsWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
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
    fontSize: FontSizes.base,
    writingDirection: 'rtl',
    textAlign: 'center',
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
    marginBottom: Spacing.four,
  },
});