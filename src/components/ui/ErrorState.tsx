// ===============================================================
// شرح الملف: هذا مكوّن واجهة مستخدم (ErrorState).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ErrorState.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// مكون عرض حالة الخطأ
// ═══════════════════════════════════════════════════════════

import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  fullscreen?: boolean;
}

// [شرح الدالة: ErrorState] يعرض حالة خطأ للمستخدم مع الرسالة والإجراء المتاح لإعادة المحاولة أو الرجوع.
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  fullscreen = true,
}: ErrorStateProps) {
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <View
      style={[
        styles.container,
        fullscreen && styles.fullscreen,
        { backgroundColor: scheme.background },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: `${scheme.danger}15`,
            borderRadius: Radii.full,
          },
        ]}
      >
        <Text style={[styles.iconGlyph, { color: scheme.danger }]}>!</Text>
      </View>

      <Text style={[styles.title, { color: scheme.text }]}>
        {title ?? t('common.somethingWentWrong')}
      </Text>

      {message ? (
        <Text style={[styles.message, { color: scheme.textSecondary }]}>{message}</Text>
      ) : null}

      {onRetry ? (
        <View style={styles.actions}>
          <AppButton
            title={retryLabel ?? t('common.retry')}
            variant="primary"
            size="md"
            onPress={onRetry}
            style={{ minWidth: 180 }}
          />
        </View>
      ) : null}
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
  iconBox: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  iconGlyph: {
    fontSize: 40,
    fontWeight: FontWeights.extrabold,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  message: {
    fontSize: FontSizes.base,
    textAlign: 'center',
    marginBottom: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
});
