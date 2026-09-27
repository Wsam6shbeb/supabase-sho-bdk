// ===============================================================
// شرح الملف: هذا صفحة استعادة كلمة المرور.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ForgotPasswordScreen، handleSend.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة استعادة كلمة المرور
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import type { ForgotPasswordDto } from '@/types/auth';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView, StyleSheet, Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: ForgotPasswordScreen] يعرض نموذج بدء استعادة كلمة المرور.
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { forgotPassword, isLoading, lastError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const validate = (): boolean => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError(t('auth.login.requiredEmail'));
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailError(t('auth.login.invalidEmail'));
      return false;
    }
    setEmailError(null);
    return true;
  };

// [شرح الدالة: handleSend] يرسل البيانات الحالية إلى العملية المرتبطة بالصفحة، مثل الرسالة أو رمز التحقق.
  const handleSend = async () => {
    if (submitting) return;
    clearError();
    setSuccessMsg(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const dto: ForgotPasswordDto = { email: email.trim().toLowerCase() };
      const res = await forgotPassword(dto);
      if (res) {
        setSuccessMsg(res.detail ?? t('auth.forgotPassword.successMessage'));
        router.push({ pathname: '/auth/reset-password', params: { email: email.trim().toLowerCase() } });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const boxBg = successMsg
    ? `${scheme.success}15`
    : lastError
      ? `${scheme.danger}15`
      : 'transparent';
  const boxFg = successMsg
    ? scheme.success
    : lastError
      ? scheme.danger
      : scheme.textSecondary;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Link href="/auth/login" asChild>
              <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text style={StyleSheet.flatten([styles.backText, { color: scheme.primary }])}>← رجوع</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, { color: scheme.text }]}>
              {t('auth.forgotPassword.title')}
            </Text>
            <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
              {t('auth.forgotPassword.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <AppTextInput
              label={t('auth.forgotPassword.emailLabel')}
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
              type="email"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                setEmailError(null);
                clearError();
                setSuccessMsg(null);
              }}
              error={emailError}
              required
            />

            {(successMsg || lastError) ? (
              <AppCard
                style={{
                  backgroundColor: boxBg,
                  marginBottom: Spacing.four,
                  borderRadius: Radii.lg,
                }}
                padding="four"
              >
                <Text style={{ color: boxFg, fontSize: FontSizes.sm, fontWeight: FontWeights.medium, textAlign: 'right' }}>
                  {successMsg
                    ? successMsg
                    : lastError?.message ?? t('common.somethingWentWrong')}
                </Text>
              </AppCard>
            ) : null}

            <AppButton
              title={t('auth.forgotPassword.sendBtn')}
              variant="primary"
              size="lg"
              onPress={handleSend}
              loading={isLoading || submitting}
              disabled={isLoading || submitting}
            />

            <View style={styles.backRow}>
              <Link href="/auth/login" asChild>
                <Text style={StyleSheet.flatten([styles.backLink, { color: scheme.primary }])}>
                  {t('auth.forgotPassword.backToLogin')}
                </Text>
              </Link>
            </View>
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
  headerRow: { marginBottom: Spacing.five, alignSelf: 'flex-start' },
  backText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
  },
  header: { marginBottom: Spacing.seven },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.two,
  },
  subtitle: { fontSize: FontSizes.base },
  form: { marginBottom: Spacing.six },
  backRow: {
    marginTop: Spacing.six,
    alignItems: 'center',
  },
  backLink: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
  },
});
