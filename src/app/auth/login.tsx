// ===============================================================
// شرح الملف: هذا صفحة تسجيل الدخول.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: LoginScreen، handleSubmit، handleGoogle.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة تسجيل الدخول
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { GoogleButton } from '@/components/ui/GoogleButton';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import type { LoginDto } from '@/types/auth';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView, StyleSheet, Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface FormErrors {
  email?: string | null;
  password?: string | null;
  form?: string | null;
}

// [شرح الدالة: LoginScreen] يعرض واجهة تسجيل الدخول ويجمع بيانات المستخدم وعمليات المصادقة.
export default function LoginScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { login, loginWithGoogle, isLoading, lastError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const lastErrorMsg = lastError?.message ?? null;
  const formLevelError = errors.form ?? lastErrorMsg;


  const validate = (): boolean => {
    const next: FormErrors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      next.email = t('auth.login.requiredEmail');
    } else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      next.email = t('auth.login.invalidEmail');
    }
    if (!password) {
      next.password = t('auth.login.requiredPassword');
    } else if (password.length < 6) {
      next.password = t('auth.login.shortPassword');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

// [شرح الدالة: handleSubmit] يعالج إرسال النموذج الحالي بعد التحقق من البيانات وتنفيذ العملية المطلوبة.
  const handleSubmit = async () => {
    if (submitting) return;
    clearError();
    setErrors({});
    if (!validate()) return;
    setSubmitting(true);
    try {
      const dto: LoginDto = { email: email.trim(), password };
      const result = await login(dto);
      if (result) {
        router.replace('/(drawer)/(tabs)');
      }
    } finally {
      setSubmitting(false);
    }
  };

// [شرح الدالة: handleGoogle] يعالج بدء تسجيل الدخول عبر Google وإكمال نتيجته داخل التطبيق.
  const handleGoogle = async () => {
    if (submitting || isLoading) return;
    clearError();
    setErrors({});
    setSubmitting(true);

    try {
      const result = await loginWithGoogle();
      if (result) {
        router.replace('/(drawer)/(tabs)');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
          <View style={styles.header}>
            <Text style={[styles.appName, { color: scheme.primary }]}>شو بدك؟</Text>
            <Text style={[styles.title, { color: scheme.text }]}>
              {t('auth.login.title')}
            </Text>
            <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
              {t('auth.login.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <AppTextInput
              label={t('auth.login.emailLabel')}
              placeholder={t('auth.login.emailPlaceholder')}
              type="email"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                setErrors((prev) => ({ ...prev, email: null, form: null }));
              }}
              error={errors.email}
              autoComplete="email"
            />
            <AppTextInput
              label={t('auth.login.passwordLabel')}
              placeholder={t('auth.login.passwordPlaceholder')}
              type="password"
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                setErrors((prev) => ({ ...prev, password: null, form: null }));
              }}
              error={errors.password}
              autoComplete="password"
            />

            <View style={styles.forgotRow}>
              <Link href="/auth/forgot-password" asChild>
                <Text style={StyleSheet.flatten([styles.forgotText, { color: scheme.primary }])}>
                  {t('auth.login.forgotPassword')}
                </Text>
              </Link>
            </View>

            {formLevelError ? (
              <View style={[styles.errorBox, { backgroundColor: `${scheme.danger}15` }]}>
                <Text style={[styles.errorBoxText, { color: scheme.danger }]}>
{formLevelError}
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: Spacing.four }}>
              <AppButton
                title={t('auth.login.loginBtn')}
                variant="primary"
                size="lg"
                onPress={handleSubmit}
                loading={isLoading || submitting}
                disabled={isLoading || submitting}
              />
            </View>

            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: scheme.border }]} />
              <Text style={[styles.orText, { color: scheme.textTertiary }]}>أو</Text>
              <View style={[styles.orLine, { backgroundColor: scheme.border }]} />
            </View>

            <GoogleButton
              onPress={handleGoogle}
              loading={submitting}
              disabled={submitting || isLoading}
            />

          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: scheme.textSecondary }]}>
              {t('auth.login.noAccount')}{' '}
            </Text>
            <Link href="/auth/register" asChild>
              <Text style={StyleSheet.flatten([styles.footerAction, { color: scheme.primary }])}>
                {t('auth.login.registerHere')}
              </Text>
            </Link>
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
    paddingTop: Spacing.ten,
    flexGrow: 1,
  },
  header: {
    marginBottom: Spacing.seven,
    alignItems: 'flex-start',
  },
  appName: {
    fontSize: FontSizes['3xl'],
    fontWeight: FontWeights.extrabold,
    marginBottom: Spacing.five,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.two,
  },
  subtitle: {
    fontSize: FontSizes.base,
  },
  form: {
    marginBottom: Spacing.six,
  },
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: Spacing.two,
    marginTop: -Spacing.two,
  },
  forgotText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    textAlign: 'left',
  },
  errorBox: {
    borderRadius: 12,
    padding: Spacing.four,
    marginTop: Spacing.three,
  },
  errorBoxText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    textAlign: 'right',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.six,
    gap: Spacing.four,
  },
  orLine: { flex: 1, height: 1 },
  orText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    paddingHorizontal: Spacing.two,
  },
  demoHint: {
    marginTop: Spacing.five,
    fontSize: FontSizes.xs,
    textAlign: 'center',
    width: '100%',
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
  },
  footerText: {
    fontSize: FontSizes.sm,
  },
  footerAction: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
});
