// ===============================================================
// شاشة بديلة عند حدوث خطأ غير متوقع أثناء رسم الشاشة (بدل الشاشة الحمراء أو الانهيار).
// تُربط في src/app/_layout.tsx بسطر واحد:
//   export { AppErrorBoundary as ErrorBoundary } from '@/components/ui/AppErrorBoundary';
// تفاصيل الخطأ تذهب لسجل المطوّر فقط، ولا تظهر للمستخدم.
// ===============================================================

import { AppButton } from '@/components/ui/AppButton';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logError } from '@/services/logger';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const scheme = Colors[useTheme()];
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    logError('[ErrorBoundary] خطأ غير متوقع أثناء عرض الشاشة:', error);
  }, [error]);

  const handleRetry = () => {
    if (retrying) return;
    setRetrying(true);
    void Promise.resolve(retry()).finally(() => setRetrying(false));
  };

  return (
    <ScreenSafeArea style={[styles.safe, { backgroundColor: scheme.background }]}>
      <View style={styles.center}>
        <View style={[styles.iconCircle, { backgroundColor: `${scheme.warning}15` }]}>
          <Ionicons name="alert-circle-outline" size={56} color={scheme.warning} />
        </View>
        <Text style={[styles.title, { color: scheme.text }]}>حدثت مشكلة غير متوقعة</Text>
        <Text style={[styles.message, { color: scheme.textSecondary }]}>
          يرجى المحاولة مجدداً.
        </Text>
        <AppButton
          title="إعادة المحاولة"
          variant="primary"
          size="lg"
          onPress={handleRetry}
          loading={retrying}
          disabled={retrying}
          style={styles.button}
        />
      </View>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.five,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  message: {
    fontSize: FontSizes.base,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.six,
  },
  button: { width: '100%' },
});
