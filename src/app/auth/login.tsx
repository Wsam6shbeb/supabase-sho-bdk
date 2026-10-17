// ===============================================================
// شرح الملف: هذا صفحة تسجيل الدخول.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: LoginScreen، handleSubmit، handleGoogle.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة تسجيل الدخول
// ═══════════════════════════════════════════════════════════

import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { GoogleButton } from '@/components/ui/GoogleButton';
import { ENABLE_EMAIL_AUTH } from '@/config/auth';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import type { LoginDto } from '@/types/auth';
import { getSupportContacts, type SupportContacts } from '@/services/support';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Image, Linking, Pressable, ScrollView, StyleSheet, Text,
    View
} from 'react-native';

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
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [supportContacts, setSupportContacts] = useState<SupportContacts>({ email: 'shobdkhelpcenter@gmail.com', phone: '' });

  useEffect(() => {
    let active = true;
    void getSupportContacts().then((contacts) => {
      if (active) setSupportContacts(contacts);
    });
    return () => { active = false; };
  }, []);

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
    if (!privacyAccepted) {
      setErrors({ form: 'يرجى الموافقة على سياسة الخصوصية قبل تسجيل الدخول.' });
      return;
    }
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
    <ScreenSafeArea style={[styles.safe, { backgroundColor: scheme.background }]}>
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
            <Image source={require('../../../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
            <Text style={[styles.title, { color: scheme.text }]}>
              {t('auth.login.title')}
            </Text>
            <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
              {t('auth.login.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            {ENABLE_EMAIL_AUTH ? (
              <>
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
              </>
            ) : null}

            {formLevelError ? (
              <View style={[styles.errorBox, { backgroundColor: `${scheme.danger}15` }]}>
                <Text style={[styles.errorBoxText, { color: scheme.danger }]}>
{formLevelError}
                </Text>
              </View>
            ) : null}

            {lastError?.code === 'ACCOUNT_SUSPENDED' ? (
              <View style={[styles.errorBox, { backgroundColor: scheme.backgroundElevated, marginTop: Spacing.two }]}>
                <Text style={[styles.errorBoxText, { color: scheme.text, marginBottom: Spacing.two }]}>
                  للتواصل مع الإدارة:
                </Text>
                <Text
                  onPress={() => void Linking.openURL(`mailto:${supportContacts.email}`)}
                  style={[styles.errorBoxText, { color: scheme.primary, marginBottom: supportContacts.phone ? Spacing.two : 0 }]}
                >
                  البريد الإلكتروني: {supportContacts.email}
                </Text>
                {supportContacts.phone ? (
                  <Text
                    onPress={() => void Linking.openURL(`tel:${supportContacts.phone}`)}
                    style={[styles.errorBoxText, { color: scheme.primary }]}
                  >
                    الهاتف: {supportContacts.phone}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {ENABLE_EMAIL_AUTH ? (
              <>
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
              </>
            ) : null}

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyAccepted }}
              onPress={() => {
                setPrivacyAccepted((accepted) => !accepted);
                setErrors((prev) => ({ ...prev, form: null }));
              }}
              style={styles.privacyRow}
            >
              <Text style={[styles.privacyCheckbox, { color: scheme.primary }]}>
                {privacyAccepted ? '☑' : '☐'}
              </Text>
              <Text style={[styles.privacyText, { color: scheme.text }]}>
                أوافق على سياسة الخصوصية
              </Text>
            </Pressable>
            <Text
              onPress={() => void Linking.openURL('https://ho-bdk-policy.abo-majd85.workers.dev/')}
              accessibilityRole="link"
              style={[styles.privacyLink, { color: scheme.primary }]}
            >
              قراءة سياسة الخصوصية
            </Text>

            <GoogleButton
              onPress={handleGoogle}
              loading={submitting}
              disabled={submitting || isLoading}
            />

          </View>

          {ENABLE_EMAIL_AUTH ? (
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
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenSafeArea>
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
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: Spacing.five,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSizes.base,
    textAlign: 'center',
  },
  form: {
    marginBottom: Spacing.six,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  privacyCheckbox: {
    fontSize: FontSizes.xl,
  },
  privacyText: {
    fontSize: FontSizes.sm,
  },
  privacyLink: {
    fontSize: FontSizes.sm,
    textAlign: 'right',
    textDecorationLine: 'underline',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
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
