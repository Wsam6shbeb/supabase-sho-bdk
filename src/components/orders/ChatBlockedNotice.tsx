// يظهر بدل حقل الكتابة عندما لا يمكن المراسلة (حظر أو محادثة مغلقة).
// الخصوصية: من حظر يرى "حظرت هذا الشخص" مع زر إلغاء الحظر، أما المحظور فيرى رسالة محايدة ولا يعرف أنه محظور.
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type ChatBlockReason = 'blocked_by_me' | 'unavailable' | 'closed';

interface Props {
  reason: ChatBlockReason;
  /** إلغاء الحظر (يظهر فقط لمن حظر). */
  onUnblock?: () => void | Promise<void>;
}

const MESSAGES: Record<ChatBlockReason, string> = {
  blocked_by_me: 'حظرت هذا الشخص، فلا يمكنك مراسلته. ألغِ الحظر إذا أردت متابعة المحادثة.',
  unavailable: 'لا يمكن إرسال رسائل في هذه المحادثة حالياً.',
  closed: 'المراسلة غير متاحة في هذه المحادثة حالياً.',
};

export function ChatBlockedNotice({ reason, onUnblock }: Props) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [busy, setBusy] = useState(false);

  const handleUnblock = async () => {
    if (!onUnblock || busy) return;
    setBusy(true);
    try {
      await onUnblock();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: scheme.backgroundElevated, borderTopColor: scheme.border }]}>
      <View style={styles.row}>
        <Ionicons
          name={reason === 'blocked_by_me' ? 'ban-outline' : 'lock-closed-outline'}
          size={20}
          color={scheme.textSecondary}
        />
        <Text style={[styles.text, { color: scheme.textSecondary }]}>{MESSAGES[reason]}</Text>
      </View>
      {reason === 'blocked_by_me' && onUnblock && (
        <AppButton
          title="إلغاء الحظر"
          variant="secondary"
          size="md"
          onPress={() => void handleUnblock()}
          loading={busy}
          disabled={busy}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.two },
  text: {
    flex: 1,
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
