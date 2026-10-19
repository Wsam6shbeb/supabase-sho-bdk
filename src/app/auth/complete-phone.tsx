// ===============================================================
// شاشة رقم الهاتف:
//  - إجبارية بعد أول تسجيل دخول (لا يدخل التطبيق من لا رقم له).
//  - ?mode=edit : تعديل الرقم من الملف الشخصي (مع زر رجوع).
// رقمك لا يظهر لأحد إلا إذا ضغطت "شارك رقمي" داخل محادثة اتفاق فعّال.
// ===============================================================
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { formatPhoneForDisplay, normalizeSyrianPhone } from '@/domain/phone';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { INVALID_PHONE_MESSAGE, setMyPhone } from '@/services/phone';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CompletePhoneScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEdit = params.mode === 'edit';
  const { user, updateUser, logout } = useAuth();

  const [phone, setPhone] = useState(isEdit && user?.phone ? user.phone : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (busy) return;
    const normalized = normalizeSyrianPhone(phone);
    if (!normalized) {
      setError(INVALID_PHONE_MESSAGE);
      return;
    }
    setBusy(true);
    const result = await setMyPhone(phone);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    updateUser({ phone: result.phone });
    if (isEdit) router.back();
    else router.replace('/(drawer)/(tabs)');
  };

  const handleLogout = () => {
    void (async () => {
      await logout();
      router.replace('/auth/login');
    })();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isEdit && (
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <Ionicons name="arrow-forward" size={24} color={scheme.primary} />
            </Pressable>
          )}

          <Ionicons name="call-outline" size={56} color={scheme.primary} style={styles.icon} />
          <Text style={[styles.title, { color: scheme.text }]}>
            {isEdit ? 'تعديل رقم الهاتف' : 'أضف رقم هاتفك'}
          </Text>
          <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
            نحتاج رقمك ليتواصل معك الطرف الآخر عندما تقرر أنت مشاركته. رقمك لا يظهر لأحد إلا إذا
            ضغطت زر &quot;شارك رقمي&quot; داخل محادثة بعد تأكيد الاتفاق.
          </Text>

          <AppTextInput
            label="رقم الموبايل"
            placeholder="0912345678"
            type="phone"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              setError(null);
            }}
            error={error}
            required
          />
          {normalizeSyrianPhone(phone) ? (
            <Text style={[styles.preview, { color: scheme.textSecondary }]}>
              سيُحفظ كـ {formatPhoneForDisplay(normalizeSyrianPhone(phone) as string)}
            </Text>
          ) : null}

          <AppButton
            title={isEdit ? 'حفظ الرقم' : 'متابعة'}
            variant="primary"
            size="lg"
            onPress={() => void handleSave()}
            loading={busy}
            disabled={busy || phone.trim().length === 0}
          />

          {!isEdit && (
            <Pressable onPress={handleLogout} hitSlop={8} style={styles.logout}>
              <Text style={[styles.logoutText, { color: scheme.textSecondary }]}>
                تسجيل الخروج {user?.email ? `(${user.email})` : ''}
              </Text>
            </Pressable>
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
  preview: { fontSize: FontSizes.sm, textAlign: 'center' },
  logout: { alignSelf: 'center', marginTop: Spacing.two },
  logoutText: { fontSize: FontSizes.sm },
});
