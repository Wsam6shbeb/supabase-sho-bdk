// ===============================================================
// شرح الملف: هذا مكوّن مرتبط بالطلبات/المحادثات (ChatInput).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ChatInput، handleSend.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { containsPhoneNumber } from '@/domain/chatSafety';

interface ChatInputProps {
  onSend: (text: string) => void;
  /** يُستدعى مع كل تغيير في النص (لمؤشر "يكتب الآن"). */
  onChangeText?: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// [شرح الدالة: ChatInput] يعرض حقل كتابة الرسالة وزر الإرسال داخل المحادثة.
export function ChatInput({ onSend, onChangeText, disabled, placeholder }: ChatInputProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [text, setText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

// [شرح الدالة: handleSend] يرسل البيانات الحالية إلى العملية المرتبطة بالصفحة، مثل الرسالة أو رمز التحقق.
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (containsPhoneNumber(trimmed)) {
      setValidationError('مشاركة أرقام الهاتف داخل المحادثة غير مسموحة. اكتب الرسالة بدون رقم هاتف.');
      return;
    }
    setValidationError(null);
    onSend(trimmed);
    setText('');
    onChangeText?.('');
  };

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: scheme.backgroundElevated, borderTopColor: scheme.border },
      ]}
    >
      <TextInput
        value={text}
        onChangeText={(value) => {
          setText(value);
          setValidationError(null);
          onChangeText?.(value);
        }}
        placeholder={placeholder ?? t('orders.chat.inputPlaceholder')}
        placeholderTextColor={scheme.textTertiary}
        multiline
        editable={!disabled}
        style={[
          styles.input,
          {
            backgroundColor: scheme.inputBackground,
            color: scheme.text,
            borderColor: scheme.border,
          },
        ]}
      />
      {validationError && (
        <Text style={[styles.validationError, { color: scheme.danger }]}>
          {validationError}
        </Text>
      )}
      <AppButton
        title=""
        variant="primary"
        size="md"
        onPress={handleSend}
        disabled={disabled || !text.trim()}
        fullWidth={false}
        style={styles.sendBtn}
        leadingIcon={
          <Ionicons name="send" size={18} color={scheme.primaryContrast} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: Radii.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    fontSize: FontSizes.base,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  sendBtn: {
    width: 48,
  },
  validationError: {
    position: 'absolute',
    bottom: 58,
    right: Spacing.three,
    left: Spacing.three,
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
    backgroundColor: 'transparent',
  },
});