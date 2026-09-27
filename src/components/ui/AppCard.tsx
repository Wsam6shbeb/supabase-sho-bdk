// ===============================================================
// شرح الملف: هذا مكوّن واجهة مستخدم (AppCard).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: AppCard.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// مكون البطاقة الرئيسي للتطبيق
// ═══════════════════════════════════════════════════════════

import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export interface AppCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padding?: keyof typeof Spacing;
  elevation?: keyof typeof Shadows;
}

// [شرح الدالة: AppCard] يعرض بطاقة واجهة موحدة قابلة لإعادة الاستخدام داخل التطبيق.
export function AppCard({
  children,
  style,
  padding = 'four',
  elevation = 'sm',
}: AppCardProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const shadow = Shadows[elevation];
  const pad = Spacing[padding];

  return (
    <View
      style={[
        styles.base,
        shadow,
        {
          backgroundColor: scheme.backgroundElevated,
          borderRadius: Radii.lg,
          padding: pad,
          borderWidth: 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
  },
});
