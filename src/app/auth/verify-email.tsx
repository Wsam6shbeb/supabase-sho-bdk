// ===============================================================
// شرح الملف: هذا صفحة تأكيد البريد الإلكتروني.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: VerifyEmailScreen، verify، resend.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: VerifyEmailScreen] يعرض واجهة إدخال رمز تأكيد البريد الإلكتروني.
export default function VerifyEmailScreen() {
  const scheme = Colors[useTheme()];
  const { verifyEmail, resendOtp, isLoading, lastError, clearError } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(String(params.email ?? ''));
  const [code, setCode] = useState('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);

// [شرح الدالة: verify] يرسل رمز التحقق ويتعامل مع نتيجة التحقق.
  const verify = async () => {
    clearError();
    if (!email.trim() || code.trim().length < 4) return;
    const result = await verifyEmail({ email: email.trim().toLowerCase(), code: code.trim() });
    if (result) router.replace('/(drawer)/(tabs)');
  };

// [شرح الدالة: resend] يطلب إعادة إرسال رمز التحقق.
  const resend = async () => {
    clearError();
    const result = await resendOtp({ email: email.trim().toLowerCase() });
    if (result) setResendMessage(result.detail);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_AVOIDING_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: scheme.text }]}>تأكيد البريد الإلكتروني</Text>
          <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
            أدخل رمز التحقق المرسل إلى بريدك الإلكتروني.
          </Text>
          <AppTextInput label="البريد الإلكتروني" type="email" value={email} onChangeText={setEmail} />
          <AppTextInput label="رمز التحقق" type="numeric" placeholder="123456" value={code} onChangeText={setCode} />
          {lastError ? <Text style={[styles.error, { color: scheme.danger }]}>{lastError.message}</Text> : null}
          {resendMessage ? <Text style={[styles.success, { color: scheme.success }]}>{resendMessage}</Text> : null}
          <AppButton title="تأكيد البريد" onPress={verify} loading={isLoading} disabled={isLoading} />
          <View style={{ height: Spacing.three }} />
          <AppButton title="إعادة إرسال الرمز" variant="secondary" onPress={resend} loading={isLoading} disabled={isLoading || !email.trim()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe:{flex:1}, content:{padding:Spacing.six, paddingTop:Spacing.ten},
  title:{fontSize:FontSizes['2xl'],fontWeight:FontWeights.bold,marginBottom:Spacing.two},
  subtitle:{fontSize:FontSizes.base,marginBottom:Spacing.seven},
  error:{fontSize:FontSizes.sm,marginVertical:Spacing.three,textAlign:'right'},
  success:{fontSize:FontSizes.sm,marginVertical:Spacing.three,textAlign:'right'},
});
