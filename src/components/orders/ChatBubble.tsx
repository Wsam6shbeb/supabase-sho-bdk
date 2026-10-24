// ===============================================================
// شرح الملف: هذا مكوّن مرتبط بالطلبات/المحادثات (ChatBubble).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: StatusTick، renderSystemText، ChatBubble.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage, MessageStatus } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

interface ChatBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  /** إعادة محاولة إرسال رسالة فشلت. */
  onRetry?: (messageId: string) => void;
}

const READ_COLOR = '#4FC3F7';
const FAILED_COLOR = '#FF6B6B';

// أيقونة حالة الرسالة: ساعة (جاري الإرسال) ← ✓ (أُرسلت) ← ✓✓ (وصلت) ← ✓✓ أزرق (قُرئت) ← ! (فشلت)
function StatusTick({ status, muted }: { status?: MessageStatus; muted: string }) {
  switch (status) {
    case 'sending':
      return <Ionicons name="time-outline" size={14} color={muted} />;
    case 'failed':
      return <Ionicons name="alert-circle" size={15} color={FAILED_COLOR} />;
    case 'delivered':
      return <Ionicons name="checkmark-done" size={15} color={muted} />;
    case 'read':
      return <Ionicons name="checkmark-done" size={15} color={READ_COLOR} />;
    case 'sent':
      return <Ionicons name="checkmark" size={15} color={muted} />;
    default:
      return null;
  }
}

// [شرح الدالة: renderSystemText] رسائل النظام فقط (يولّدها التطبيق/السيرفر، لا يكتبها المستخدمون):
// النص بين **نجمتين** يُعرض بخط عريض. أي نص بلا علامات يُعرض كما هو.
function renderSystemText(content: string, boldStyle: TextStyle): ReactNode[] {
  return content.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <Text key={index} style={boldStyle}>
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

// [شرح الدالة: ChatBubble] يعرض رسالة واحدة داخل المحادثة مع تنسيقها بحسب صاحب الرسالة وحالتها.
export function ChatBubble({ message, isMine, onRetry }: ChatBubbleProps) {
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
            {renderSystemText(message.content, { fontWeight: FontWeights.bold, color: scheme.text })}
          </Text>
        </View>
      </View>
    );
  }

  const failed = isMine && message.status === 'failed';
  const mutedColor = `${scheme.primaryContrast}99`;

  const bubble = (
    <View
      style={[
        styles.bubble,
        isMine
          ? { backgroundColor: scheme.primary, borderBottomRightRadius: Radii.sm }
          : { backgroundColor: scheme.backgroundElement, borderBottomLeftRadius: Radii.sm },
        failed && { opacity: 0.85, borderWidth: 1, borderColor: FAILED_COLOR },
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
      <View style={styles.metaRow}>
        <Text
          style={[
            styles.time,
            { color: isMine ? mutedColor : scheme.textTertiary },
          ]}
        >
          {new Date(message.created_at).toLocaleTimeString('ar-SY', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        {isMine && <StatusTick status={message.status} muted={mutedColor} />}
      </View>
      {failed && (
        <Text style={[styles.failedText, { color: FAILED_COLOR }]}>
          فشل الإرسال — اضغط لإعادة المحاولة
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      {failed && onRetry ? (
        <Pressable onPress={() => onRetry(message.id)} style={styles.retryWrap}>
          {bubble}
        </Pressable>
      ) : (
        bubble
      )}
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  time: {
    fontSize: FontSizes.xs,
    textAlign: 'left',
  },
  failedText: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.one,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  retryWrap: { maxWidth: '80%' },
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
