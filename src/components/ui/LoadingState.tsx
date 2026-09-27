// ===============================================================
// شرح الملف: هذا مكوّن واجهة مستخدم (LoadingState).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: LoadingState.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// مكون عرض حالة التحميل
// ═══════════════════════════════════════════════════════════

import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export interface LoadingStateProps {
  message?: string;
  fullscreen?: boolean;
}

// [شرح الدالة: LoadingState] يعرض حالة التحميل، ويمكنه عرضها داخل الصفحة أو على كامل الشاشة.
export function LoadingState({ message, fullscreen = true }: LoadingStateProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const displayMessage = message ?? t('common.loading');

  return (
    <View
      style={[
        styles.container,
        fullscreen && styles.fullscreen,
        { backgroundColor: scheme.background },
      ]}
    >
      <ActivityIndicator size="large" color={scheme.primary} />
      <Text style={[styles.text, { color: scheme.textSecondary, marginTop: Spacing.four }]}>
        {displayMessage}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreen: {
    flex: 1,
  },
  text: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
  },
});
