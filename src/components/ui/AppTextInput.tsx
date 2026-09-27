// ===============================================================
// شرح الملف: هذا مكوّن واجهة مستخدم (AppTextInput).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: handleFocus، handleBlur.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// مكون حقل الإدخال النصي
// ═══════════════════════════════════════════════════════════

import {
    BorderWidth,
    Colors,
    FontSizes,
    FontWeights,
    Radii,
    Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { forwardRef, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    type StyleProp,
    type TextInputProps,
    type TextStyle,
    type ViewStyle
} from 'react-native';

export type AppTextInputType = 'text' | 'email' | 'password' | 'phone' | 'numeric';

export interface AppTextInputProps extends Omit<TextInputProps, 'style' | 'secureTextEntry' | 'keyboardType' | 'autoCapitalize'> {
  label?: string;
  error?: string | null;
  type?: AppTextInputType;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<TextStyle>;
  required?: boolean;
}

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(function AppTextInput(
  {
    label,
    error,
    type = 'text',
    containerStyle,
    required,
    onBlur,
    onFocus,
    style,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [focused, setFocused] = useState(false);

  const keyboardType: TextInputProps['keyboardType'] = useMemo(() => {
    switch (type) {
      case 'email':
        return 'email-address';
      case 'phone':
      case 'numeric':
        return 'phone-pad';
      default:
        return 'default';
    }
  }, [type]);

  const autoCapitalize: TextInputProps['autoCapitalize'] = type === 'email' ? 'none' : 'sentences';
  const secureTextEntry = type === 'password';

// [شرح الدالة: handleFocus] يعالج تفاعل المستخدم الحالي وينفذ الإجراء المرتبط بهذا الزر أو النموذج.
  const handleFocus = (e: any) => {
    setFocused(true);
    onFocus?.(e);
  };

// [شرح الدالة: handleBlur] يعالج تفاعل المستخدم الحالي وينفذ الإجراء المرتبط بهذا الزر أو النموذج.
  const handleBlur = (e: any) => {
    setFocused(false);
    onBlur?.(e);
  };

  const borderColor = error
    ? scheme.danger
    : focused
      ? scheme.primary
      : scheme.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: scheme.text }]}>
          {label}
          {required ? <Text style={{ color: scheme.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.wrapper,
          {
            backgroundColor: scheme.inputBackground,
            borderColor,
            borderWidth: focused || error ? BorderWidth.thick : BorderWidth.thin,
            borderRadius: Radii.lg,
          },
        ]}
      >
        <TextInput
          ref={ref}
          {...rest}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          autoCorrect={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={scheme.textTertiary}
          style={[
            styles.input,
            {
              color: scheme.text,
              fontSize: FontSizes.base,
              writingDirection: 'rtl',
              textAlign: 'right',
            },
            style,
          ]}
        />
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: scheme.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: Spacing.four,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.two,
    textAlign: 'right',
  },
  wrapper: {
    width: '100%',
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    minHeight: 48,
  },
  input: {
    width: '100%',
    padding: 0,
    margin: 0,
    minHeight: 24,
  },
  errorText: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.one,
    textAlign: 'right',
  },
});
