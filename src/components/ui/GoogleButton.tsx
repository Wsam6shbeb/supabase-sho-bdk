// ===============================================================
// شرح الملف: هذا مكوّن واجهة مستخدم (GoogleButton).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: GoogleButton.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// مكون زر تسجيل الدخول عبر Google
// ═══════════════════════════════════════════════════════════

import {
    BorderWidth,
    BrandColors,
    Colors,
    FontSizes,
    FontWeights,
    Opacity,
    Radii,
    Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export interface GoogleButtonProps {
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  title?: string;
}

// [شرح الدالة: GoogleButton] يعرض زر تسجيل الدخول عبر Google وينفذ الإجراء الذي يستلمه عند الضغط عليه.
export function GoogleButton({
  onPress,
  loading,
  disabled,
  fullWidth = true,
  style,
  title,
}: GoogleButtonProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const isInteractive = !disabled && !loading;

  const label = loading ? 'جارٍ الاتصال...' : title ?? 'تسجيل الدخول عبر Google';
  const opacity = isInteractive ? 1 : Opacity.disabled;

  return (
    <Pressable
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: scheme.backgroundElevated,
          borderColor: scheme.border,
          borderWidth: BorderWidth.thin,
          borderRadius: Radii.lg,
          opacity: pressed && isInteractive ? Opacity.pressed : opacity,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: scheme.backgroundElement, borderRadius: Radii.md },
          ]}
        >
          <Text style={[styles.iconGlyph, { color: BrandColors.primary }]}>G</Text>
        </View>
        <Text
          style={[
            styles.label,
            {
              color: scheme.text,
              fontSize: FontSizes.base,
              fontWeight: FontWeights.semibold,
            },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 24,
    height: 24,
    marginEnd: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 16,
    fontWeight: FontWeights.bold,
  },
  label: {
    includeFontPadding: false,
    textAlign: 'center',
  },
});
