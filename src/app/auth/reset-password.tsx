// ===============================================================
// شرح الملف: هذا صفحة تعيين كلمة المرور الجديدة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ResetPasswordScreen، submit.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: ResetPasswordScreen] يعرض نموذج تعيين كلمة المرور الجديدة.
export default function ResetPasswordScreen() {
  const scheme = Colors[useTheme()];
  const { resetPassword, isLoading, lastError } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(String(params.email ?? ''));
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);

// [شرح الدالة: submit] ينفذ إرسال النموذج الحالي ويعالج النتيجة.
  const submit = async () => {
    const result = await resetPassword({
      email: email.trim().toLowerCase(),
      code: code.trim(),
      new_password: password,
    });
    if (result) setDone(true);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_AVOIDING_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: scheme.text }]}>تعيين كلمة مرور جديدة</Text>
          <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>أدخل رمز الاستعادة الذي وصلك بالبريد.</Text>
          <AppTextInput label="البريد الإلكتروني" type="email" value={email} onChangeText={setEmail} />
          <AppTextInput label="رمز الاستعادة" type="numeric" value={code} onChangeText={setCode} />
          <AppTextInput label="كلمة المرور الجديدة" type="password" value={password} onChangeText={setPassword} />
          {lastError ? <Text style={[styles.message, { color: scheme.danger }]}>{lastError.message}</Text> : null}
          {done ? (
            <Text style={[styles.message, { color: scheme.success }]}>تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.</Text>
          ) : (
            <AppButton title="تغيير كلمة المرور" onPress={submit} loading={isLoading} disabled={isLoading} />
          )}
          {done ? <Link href="/auth/login" onPress={() => router.replace('/auth/login')}>العودة لتسجيل الدخول</Link> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe:{flex:1}, content:{padding:Spacing.six,paddingTop:Spacing.ten},
  title:{fontSize:FontSizes['2xl'],fontWeight:FontWeights.bold,marginBottom:Spacing.two},
  subtitle:{fontSize:FontSizes.base,marginBottom:Spacing.seven},
  message:{fontSize:FontSizes.sm,marginVertical:Spacing.four,textAlign:'right'},
});
