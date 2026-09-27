// ===============================================================
// شرح الملف: هذا مكوّن مرتبط بالطلبات/المحادثات (ChatBubble).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ChatBubble.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/types/orders';
import { StyleSheet, Text, View } from 'react-native';

interface ChatBubbleProps {
  message: ChatMessage;
  isMine: boolean;
}

// [شرح الدالة: ChatBubble] يعرض رسالة واحدة داخل المحادثة مع تنسيقها بحسب صاحب الرسالة وحالتها.
export function ChatBubble({ message, isMine }: ChatBubbleProps) {
  const theme = useTheme();
  const scheme = Colors[theme];

  if (message.is_system) {
    return (
      <View style={styles.systemWrap}>
        <View
          style={[
            styles.systemBubble,
            { backgroundColor: `${scheme.warning}15`, borderColor: `${scheme.warning}40` },
          ]}
        >
          <Text style={[styles.systemText, { color: scheme.textSecondary }]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      <View
        style={[
          styles.bubble,
          isMine
            ? { backgroundColor: scheme.primary, borderBottomRightRadius: Radii.sm }
            : { backgroundColor: scheme.backgroundElement, borderBottomLeftRadius: Radii.sm },
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: isMine ? scheme.primaryContrast : scheme.text },
          ]}
        >
          {message.content}
        </Text>
        <Text
          style={[
            styles.time,
            { color: isMine ? `${scheme.primaryContrast}99` : scheme.textTertiary },
          ]}
        >
          {new Date(message.created_at).toLocaleTimeString('ar-SY', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  rowMine: { justifyContent: 'flex-start' },
  rowOther: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radii.lg,
  },
  text: {
    fontSize: FontSizes.base,
    lineHeight: FontSizes.lg + 4,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  time: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.one,
    textAlign: 'left',
  },
  systemWrap: {
    alignItems: 'center',
    paddingHorizontal: Spacing.six,
    marginBottom: Spacing.four,
  },
  systemBubble: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  systemText: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.base + 4,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});