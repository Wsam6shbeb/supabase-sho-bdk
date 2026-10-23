// ===============================================================
// شريط توثيق الطرف الآخر أسفل ترويسة المحادثة
// - موثّق: شارة خضراء فقط.
// - غير موثّق: شارة محايدة (بدون إيحاء بمخالفة) + زر "اطلب توثيق الحساب" مرة واحدة.
// لا يعرض أي تفاصيل مراجعة ولا صور.
// ===============================================================

import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import type { CounterpartyVerificationState } from '@/hooks/use-counterparty-verification';
import { useTheme } from '@/hooks/use-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

interface VerificationBarProps {
  state: CounterpartyVerificationState;
  otherName: string;
}

export function VerificationBar({ state, otherName }: VerificationBarProps) {
  const scheme = Colors[useTheme()];
  const { data, requesting, request } = state;
  if (!data) return null;

  const color = data.verified ? scheme.success : scheme.textSecondary;

  const confirmRequest = () => {
    Alert.alert(
      'طلب توثيق الحساب',
      `سيصل ${otherName} إشعار ورسالة في المحادثة تطلب توثيق حسابه. متابعة؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إرسال',
          onPress: () => {
            void request().then((result) => {
              if (!result.ok) Alert.alert('', result.message ?? 'تعذّر إرسال الطلب.');
            });
          },
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: scheme.backgroundElevated, borderBottomColor: scheme.border },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: `${color}15` }]}>
        <Ionicons
          name={data.verified ? 'checkmark-circle' : 'shield-outline'}
          size={14}
          color={color}
        />
        <Text style={[styles.badgeText, { color }]}>
          {data.verified ? 'حساب موثّق' : 'حساب غير موثّق'}
        </Text>
      </View>

      {data.verified ? null : data.requestedByMe ? (
        <Text style={[styles.note, { color: scheme.textTertiary }]}>تم إرسال طلب التوثيق</Text>
      ) : (
        <Pressable
          onPress={confirmRequest}
          disabled={requesting}
          hitSlop={8}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="اطلب توثيق الحساب"
        >
          {requesting ? (
            <ActivityIndicator size="small" color={scheme.primary} />
          ) : (
            <Text style={[styles.actionText, { color: scheme.primary }]}>اطلب توثيق الحساب</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radii.full,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  action: { paddingVertical: Spacing.one },
  actionText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  note: { fontSize: FontSizes.xs, writingDirection: 'rtl' },
});
