import { AppButton } from '@/components/ui/AppButton';
import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type RpcResponse = { data: any; error: { message?: string } | null };
const callRpc = supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => Promise<RpcResponse>;
const RPC_TIMEOUT_MS = 20_000;

async function callRpcWithTimeout(name: string, args?: Record<string, unknown>): Promise<RpcResponse> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      callRpc(name, args),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('DISPLAY_NAME_TIMEOUT')), RPC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default function CompleteDisplayNameScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEdit = params.mode === 'edit';
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (busy) return;
    const value = displayName.trim().replace(/\s+/g, ' ');
    if (value && (value.length < 2 || value.length > 40)) {
      setError('يجب أن يتراوح الاسم بين حرفين و40 حرفاً.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await callRpcWithTimeout('set_my_display_name', { p_display_name: value });
      if (rpcError) {
        const message = rpcError.message ?? '';
        setError(message.includes('DISPLAY_NAME_TAKEN')
          ? 'هذا الاسم مستخدم بالفعل. اختر اسماً آخر.'
          : message.includes('DISPLAY_NAME_PHONE_NOT_ALLOWED')
            ? 'لا يمكن أن يحتوي الاسم على رقم هاتف.'
            : message.includes('DISPLAY_NAME_LENGTH')
              ? 'يجب أن يتراوح الاسم بين حرفين و40 حرفاً.'
              : 'تعذر حفظ الاسم الآن. تحقق من الاتصال وحاول مجدداً.');
        return;
      }

      const savedName = typeof data?.display_name === 'string' ? data.display_name : null;
      updateUser({
        display_name: savedName,
        name: savedName || user?.full_name || user?.name || 'مستخدم',
        display_name_prompted_at: data?.display_name_prompted_at ?? new Date().toISOString(),
      });
      if (isEdit) router.back();
      else router.replace('/(drawer)/(tabs)');
    } catch (err) {
      setError(err instanceof Error && err.message === 'DISPLAY_NAME_TIMEOUT'
        ? 'استغرق الاتصال وقتاً أطول من المتوقع. تحقق من الإنترنت؛ وإذا لم يتغير الاسم، حاول مجدداً.'
        : 'حدث خطأ غير متوقع أثناء حفظ الاسم. تحقق من الاتصال وحاول مجدداً.');
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await callRpcWithTimeout('skip_my_display_name_prompt');
      if (rpcError) {
        setError('تعذر المتابعة الآن. تحقق من الاتصال وحاول مجدداً.');
        return;
      }
      updateUser({ display_name_prompted_at: data?.display_name_prompted_at ?? new Date().toISOString() });
      router.replace('/(drawer)/(tabs)');
    } catch {
      setError('تعذر إكمال المتابعة بسبب تأخر الاتصال. تحقق من الإنترنت وحاول مجدداً.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isEdit && (
            <GuardedPressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <Ionicons name="arrow-forward" size={24} color={scheme.primary} />
            </GuardedPressable>
          )}
          <Ionicons name="person-circle-outline" size={62} color={scheme.primary} style={styles.icon} />
          <Text style={[styles.title, { color: scheme.text }]}>
            {isEdit ? 'تعديل الاسم الظاهر للجميع' : 'كيف تحب أن يراك الآخرون؟'}
          </Text>
          <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
            أدخل اسماً مستعاراً يظهر للمستخدمين الآخرين في التطبيق، مثل «الرحال للعقارات». يبقى اسمك الحقيقي محفوظاً لبيانات الحساب.
          </Text>
          <View style={[styles.inputWrap, { borderColor: error ? scheme.danger : scheme.border, backgroundColor: scheme.backgroundElevated }]}>
            <TextInput
              value={displayName}
              onChangeText={(value) => { setDisplayName(value); setError(null); }}
              placeholder="مثلاً: الرحال للعقارات"
              placeholderTextColor={scheme.textTertiary}
              maxLength={40}
              autoCapitalize="sentences"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void handleSave()}
              style={[styles.input, { color: scheme.text }]}
            />
          </View>
          <Text style={[styles.hint, { color: scheme.textTertiary }]}>من حرفين إلى 40 حرفاً. لا تكتب رقم هاتفك.</Text>
          {error ? <Text style={[styles.error, { color: scheme.danger }]}>{error}</Text> : null}
          <AppButton
            title={isEdit ? 'حفظ الاسم' : 'متابعة'}
            variant="primary"
            size="lg"
            onPress={() => void handleSave()}
            loading={busy}
            disabled={busy}
          />
          {!isEdit && (
            <GuardedPressable onPress={() => void handleSkip()} disabled={busy} style={styles.skip}>
              <Text style={[styles.skipText, { color: scheme.textSecondary }]}>تخطي الآن</Text>
            </GuardedPressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  back: { alignSelf: 'flex-start' },
  icon: { alignSelf: 'center' },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, textAlign: 'center' },
  subtitle: { fontSize: FontSizes.base, textAlign: 'center', lineHeight: 24 },
  inputWrap: { borderWidth: 1, borderRadius: 12, paddingHorizontal: Spacing.three },
  input: { minHeight: 52, textAlign: 'right', fontSize: FontSizes.base },
  hint: { fontSize: FontSizes.sm, textAlign: 'right' },
  error: { fontSize: FontSizes.sm, textAlign: 'right' },
  skip: { alignSelf: 'center', padding: Spacing.two },
  skipText: { fontSize: FontSizes.base, fontWeight: FontWeights.medium },
});
