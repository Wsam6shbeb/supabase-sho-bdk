// ===============================================================
// شرح الملف: هذا مكوّن واجهة مستخدم (AppButton).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// مكون الزر الرئيسي للتطبيق
// ═══════════════════════════════════════════════════════════

import { Colors, FontSizes, FontWeights, Opacity, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { forwardRef, type ReactNode } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

export type AppButtonVariant = 'primary' | 'secondary' | 'urgent' | 'ghost' | 'danger';
export type AppButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const AppButton = forwardRef<View, AppButtonProps>(function AppButton(
  {
    title,
    variant = 'primary',
    size = 'lg',
    loading = false,
    disabled = false,
    fullWidth = true,
    icon,
    leadingIcon,
    trailingIcon,
    style,
    onPress,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const scheme = Colors[theme];

  const sizeConfig: Record<AppButtonSize, { h: number; fs: number; px: number; py: number }> = {
    sm: { h: 36, fs: FontSizes.sm, px: Spacing.four, py: Spacing.two },
    md: { h: 44, fs: FontSizes.base, px: Spacing.five, py: Spacing.three },
    lg: { h: 52, fs: FontSizes.lg, px: Spacing.six, py: Spacing.four },
  };

  const sc = sizeConfig[size];
  const isInteractive = !disabled && !loading;

  const getBgColor = (): string => {
    switch (variant) {
      case 'primary':
        return scheme.primary;
      case 'urgent':
        return scheme.urgent;
      case 'danger':
        return scheme.danger;
      case 'secondary':
        return scheme.backgroundElement;
      case 'ghost':
        return 'transparent';
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
        return scheme.primaryContrast;
      case 'urgent':
        return scheme.urgentContrast;
      case 'danger':
        return scheme.dangerContrast;
      case 'secondary':
        return scheme.text;
      case 'ghost':
        return scheme.primary;
    }
  };

  const bg = getBgColor();
  const fg = getTextColor();
  const opacity = isInteractive ? 1 : Opacity.disabled;

  return (
    <Pressable
      ref={ref}
      {...rest}
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: bg,
          minHeight: sc.h,
          paddingHorizontal: sc.px,
          paddingVertical: sc.py,
          borderRadius: Radii.lg,
          borderWidth: variant === 'ghost' ? 0 : 0,
          opacity: pressed && isInteractive ? Opacity.pressed : opacity,
        },
        style,
      ]}
      android_ripple={{ color: `${fg}20`, borderless: false, foreground: false }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.content}>
          {leadingIcon ? <View style={styles.iconSlot}>{leadingIcon}</View> : null}
          {icon && !leadingIcon ? (
            <Text style={[styles.iconGlyph, { color: fg, fontSize: sc.fs + 2 }]}>{icon}</Text>
          ) : null}
          <Text
            style={{
              color: fg,
              fontSize: sc.fs,
              fontWeight: FontWeights.semibold,
              includeFontPadding: false,
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
          {trailingIcon ? <View style={styles.iconSlot}>{trailingIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  iconSlot: {
    marginHorizontal: Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    marginEnd: Spacing.two,
  },
});
