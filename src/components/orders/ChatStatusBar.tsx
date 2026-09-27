// ===============================================================
// شرح الملف: هذا مكوّن مرتبط بالطلبات/المحادثات (ChatStatusBar).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ChatStatusBar.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ChatStatus } from '@/types/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

interface ChatStatusBarProps {
  status: ChatStatus;
}

const STATUS_CONFIG: Record<
  ChatStatus,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    colorKey: 'primary' | 'warning' | 'success' | 'danger' | 'textTertiary';
  }
> = {
  [ChatStatus.NEGOTIATING]: {
    label: 'تفاوضية',
    icon: 'chatbubbles-outline',
    colorKey: 'primary',
  },
  [ChatStatus.AWAITING_APPROVAL]: {
    label: 'بانتظار موافقة',
    icon: 'time-outline',
    colorKey: 'warning',
  },
  [ChatStatus.ACTIVE]: {
    label: 'نشطة',
    icon: 'checkmark-circle-outline',
    colorKey: 'success',
  },
  [ChatStatus.LOCKED_NOT_CHOSEN]: {
    label: 'مقفلة — لم يتم اختيارك',
    icon: 'lock-closed-outline',
    colorKey: 'textTertiary',
  },
  [ChatStatus.LOCKED_COMPLETED]: {
    label: 'مقفلة — مكتملة',
    icon: 'lock-closed-outline',
    colorKey: 'textTertiary',
  },
};

// [شرح الدالة: ChatStatusBar] يعرض شريط الحالة الخاص بالمحادثة أو الطلب الحالي.
export function ChatStatusBar({ status }: ChatStatusBarProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const config = STATUS_CONFIG[status];
  const color = scheme[config.colorKey];

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: `${color}15`, borderBottomColor: `${color}30` },
      ]}
    >
      <Ionicons name={config.icon} size={16} color={color} />
      <Text style={[styles.label, { color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
});