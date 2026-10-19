// ===============================================================
// شرح الملف: هذا صفحة التحقق من الحساب.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: VerifyAccountScreen، pickImage، handleSubmit.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة توثيق الحساب
// ═══════════════════════════════════════════════════════════

import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

// [شرح الدالة: VerifyAccountScreen] يعرض خطوات التحقق من الحساب ورفع المستند/الصورة المطلوبة.
export default function VerifyAccountScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const {
    verificationStatus,
    verificationRequest,
    submitVerification,
    resetVerification,
  } = useOrder();

  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // رفع صورة
  // ═══════════════════════════════════════════════════════════
// [شرح الدالة: pickImage] يفتح اختيار الصورة لإرفاقها ضمن عملية التحقق.
  const pickImage = async (target: 'id' | 'selfie') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('صلاحية الكاميرا', 'يرجى السماح باستخدام الكاميرا من إعدادات الهاتف ثم المحاولة مجدداً.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        cameraType: target === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        allowsEditing: true,
        aspect: target === 'selfie' ? [1, 1] : [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        if (target === 'id') setIdPhoto(uri);
        else setSelfie(uri);
      }
    } catch {
      Alert.alert('خطأ', 'تعذّر فتح الكاميرا');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // إرسال
  // ═══════════════════════════════════════════════════════════
// [شرح الدالة: handleSubmit] يعالج إرسال النموذج الحالي بعد التحقق من البيانات وتنفيذ العملية المطلوبة.
  const handleSubmit = async () => {
    if (!idPhoto || !selfie) {
      Alert.alert('مطلوب', t('verification.requiredPhotos'));
      return;
    }

    setSubmitting(true);
    try {
      await submitVerification(idPhoto, selfie);
    } catch (error) {
      Alert.alert(
        'تعذّر إرسال التوثيق',
        error instanceof Error ? error.message : 'حدث خطأ أثناء إرسال الصور. حاول مجدداً.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // شاشة: موثّق
  // ═══════════════════════════════════════════════════════════
  if (verificationStatus === 'verified') {
    return (
      <ScreenSafeArea
        style={[styles.safe, { backgroundColor: scheme.background }]}
      >
        <View style={styles.centerWrap}>
          <View
            style={[styles.bigIcon, { backgroundColor: `${scheme.success}15` }]}
          >
            <Ionicons name="checkmark-circle" size={80} color={scheme.success} />
          </View>
          <Text style={[styles.centerTitle, { color: scheme.text }]}>
            {t('verification.verifiedTitle')}
          </Text>
          <Text style={[styles.centerSubtitle, { color: scheme.textSecondary }]}>
            {t('verification.verifiedSubtitle')}
          </Text>
          <AppButton
            title={t('common.done')}
            variant="primary"
            size="lg"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.six, width: '100%' }}
          />
        </View>
      </ScreenSafeArea>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // شاشة: قيد المراجعة
  // ═══════════════════════════════════════════════════════════
  if (verificationStatus === 'under_review') {
    return (
      <ScreenSafeArea
        style={[styles.safe, { backgroundColor: scheme.background }]}
      >
        <View style={styles.centerWrap}>
          <View
            style={[styles.bigIcon, { backgroundColor: `${scheme.warning}15` }]}
          >
            <Ionicons name="time" size={80} color={scheme.warning} />
          </View>
          <Text style={[styles.centerTitle, { color: scheme.text }]}>
            {t('verification.underReviewTitle')}
          </Text>
          <Text style={[styles.centerSubtitle, { color: scheme.textSecondary }]}>
            {t('verification.underReviewSubtitle')}
          </Text>

          {verificationRequest?.submitted_at && (
            <Text style={[styles.timestamp, { color: scheme.textTertiary }]}>
              {t('verification.submittedAt')}:{' '}
              {new Date(verificationRequest.submitted_at).toLocaleString('ar-SY')}
            </Text>
          )}

          <AppButton
            title={t('common.back')}
            variant="secondary"
            size="lg"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.six, width: '100%' }}
          />
        </View>
      </ScreenSafeArea>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // شاشة: مرفوض (للتجربة)
  // ═══════════════════════════════════════════════════════════
  if (verificationStatus === 'rejected') {
    return (
      <ScreenSafeArea
        style={[styles.safe, { backgroundColor: scheme.background }]}
      >
        <View style={styles.centerWrap}>
          <View
            style={[styles.bigIcon, { backgroundColor: `${scheme.danger}15` }]}
          >
            <Ionicons name="close-circle" size={80} color={scheme.danger} />
          </View>
          <Text style={[styles.centerTitle, { color: scheme.text }]}>
            {t('verification.rejectedTitle')}
          </Text>
          <Text style={[styles.centerSubtitle, { color: scheme.textSecondary }]}>
            {t('verification.rejectedSubtitle')}
          </Text>
          {verificationRequest?.rejection_reason ? (
            <Text style={[styles.centerSubtitle, { color: scheme.danger, marginTop: Spacing.three }]}>
              سبب الرفض: {verificationRequest.rejection_reason}
            </Text>
          ) : null}
          <AppButton
            title={t('verification.retryBtn')}
            variant="primary"
            size="lg"
            onPress={resetVerification}
            style={{ marginTop: Spacing.six, width: '100%' }}
          />
        </View>
      </ScreenSafeArea>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // شاشة: غير موثّق (النموذج)
  // ═══════════════════════════════════════════════════════════
  return (
    <ScreenSafeArea
      style={[styles.safe, { backgroundColor: scheme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-forward" size={26} color={scheme.primary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: scheme.text }]}>
            {t('verification.title')}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Intro */}
        <View style={styles.introSection}>
          <View
            style={[styles.iconCircle, { backgroundColor: `${scheme.primary}15` }]}
          >
            <Ionicons name="shield-checkmark" size={40} color={scheme.primary} />
          </View>
          <Text style={[styles.title, { color: scheme.text }]}>
            {t('verification.notVerifiedTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
            {t('verification.notVerifiedSubtitle')}
          </Text>
        </View>

        {/* Benefits */}
        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: scheme.text }]}>
            {t('verification.benefitsTitle')}
          </Text>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={scheme.success} />
              <Text style={[styles.benefitText, { color: scheme.textSecondary }]}>
                {t(`verification.benefit${i}`)}
              </Text>
            </View>
          ))}
        </AppCard>

        {/* Step 1: ID Photo */}
        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: scheme.text }]}>
            {t('verification.step1Title')}
          </Text>
          <Text style={[styles.hint, { color: scheme.textSecondary }]}>
            {t('verification.step1Subtitle')}
          </Text>

          <Pressable
            onPress={() => pickImage('id')}
            style={[
              styles.uploadBox,
              {
                backgroundColor: scheme.backgroundElement,
                borderColor: idPhoto ? scheme.success : scheme.border,
              },
            ]}
          >
            {idPhoto ? (
              <>
                <Image source={{ uri: idPhoto }} style={styles.preview} />
                <View
                  style={[
                    styles.changeBadge,
                    { backgroundColor: scheme.primary },
                  ]}
                >
                  <Text style={[styles.changeText, { color: scheme.primaryContrast }]}>
                    {t('verification.changeBtn')}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons
                  name="camera-outline"
                  size={36}
                  color={scheme.textSecondary}
                />
                <Text style={[styles.uploadText, { color: scheme.textSecondary }]}>
                  {t('verification.uploadBtn')}
                </Text>
              </>
            )}
          </Pressable>
        </AppCard>

        {/* Step 2: Selfie */}
        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: scheme.text }]}>
            {t('verification.step2Title')}
          </Text>
          <Text style={[styles.hint, { color: scheme.textSecondary }]}>
            {t('verification.step2Subtitle')}
          </Text>

          <Pressable
            onPress={() => pickImage('selfie')}
            style={[
              styles.uploadBox,
              {
                backgroundColor: scheme.backgroundElement,
                borderColor: selfie ? scheme.success : scheme.border,
              },
            ]}
          >
            {selfie ? (
              <>
                <Image source={{ uri: selfie }} style={styles.previewSelfie} />
                <View
                  style={[styles.changeBadge, { backgroundColor: scheme.primary }]}
                >
                  <Text style={[styles.changeText, { color: scheme.primaryContrast }]}>
                    {t('verification.changeBtn')}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons
                  name="person-circle-outline"
                  size={36}
                  color={scheme.textSecondary}
                />
                <Text style={[styles.uploadText, { color: scheme.textSecondary }]}>
                  {t('verification.uploadBtn')}
                </Text>
              </>
            )}
          </Pressable>
        </AppCard>

        {/* Submit */}
        <View style={styles.footer}>
          <AppButton
            title={
              submitting ? t('verification.submittingBtn') : t('verification.submitBtn')
            }
            variant="primary"
            size="lg"
            onPress={handleSubmit}
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
      </ScrollView>
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
    paddingBottom: Spacing.eight,
  },
  introSection: {
    alignItems: 'center',
    marginBottom: Spacing.five,
    paddingTop: Spacing.three,
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
    lineHeight: FontSizes.lg + 4,
  },
  card: {
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  hint: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    marginBottom: Spacing.three,
    lineHeight: FontSizes.base + 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  benefitText: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    flex: 1,
  },
  uploadBox: {
    height: 160,
    borderRadius: Radii.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: Spacing.two,
  },
  preview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewSelfie: {
    width: 160,
    height: 160,
    borderRadius: Radii.full,
  },
  uploadText: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
  },
  changeBadge: {
    position: 'absolute',
    bottom: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radii.md,
  },
  changeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  footer: {
    marginTop: Spacing.four,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  bigIcon: {
    width: 140,
    height: 140,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.five,
  },
  centerTitle: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  centerSubtitle: {
    fontSize: FontSizes.base,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: FontSizes.lg + 4,
    paddingHorizontal: Spacing.four,
  },
  timestamp: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.four,
    writingDirection: 'rtl',
  },
});