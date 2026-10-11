// ===============================================================
// بطاقة مشاركة الرقم داخل المحادثة. القرار يُتخذ وقت الاتفاق عبر خانة "شارك رقمي":
//  - إذا شارك الطرف الآخر رقمه وكان الاتفاق فعّالاً: تظهر بطاقة الرقم مع اتصال/واتساب.
//  - إذا شاركت أنت رقمك: تظهر ملاحظة صغيرة.
//  - غير ذلك: لا تظهر شيئاً.
// ===============================================================
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { formatPhoneForDisplay } from '@/domain/phone';
import { useTheme } from '@/hooks/use-theme';
import { fetchPhoneShareStatus, type PhoneShareStatus } from '@/services/phone';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

interface Props {
  conversationId?: string | null;
  /** يتغير عند وصول رسالة نظام جديدة (مثل الموافقة على الاتفاق) فنعيد تحميل الحالة. */
  refreshKey?: string | null;
}

export function PhoneSharePanel({ conversationId, refreshKey }: Props) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [status, setStatus] = useState<PhoneShareStatus | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setStatus(null);
      return;
    }
    let alive = true;
    void fetchPhoneShareStatus(conversationId).then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, [conversationId, refreshKey]);

  if (!status?.available) return null;

  const otherPhone = status.other_shared ? status.other_phone : null;

  if (!otherPhone && !status.i_shared) return null;

  const box = [styles.box, { backgroundColor: scheme.backgroundElevated, borderColor: scheme.border }];

  if (!otherPhone) {
    return (
      <View style={box}>
        <View style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={18} color={scheme.textSecondary} />
          <Text style={[styles.note, { color: scheme.textSecondary }]}>
            {status.agreement_state === 'active'
              ? 'رقمك مشارَك مع الطرف الآخر.'
              : 'سيصل رقمك للطرف الآخر عند تأكيد الاتفاق.'}
          </Text>
        </View>
      </View>
    );
  }

  const digits = otherPhone.replace(/\D/g, '');

  return (
    <View style={box}>
      <View style={styles.row}>
        <Ionicons name="call" size={18} color={scheme.primary} />
        <Text style={[styles.title, { color: scheme.text }]}>
          رقم {status.other_name ?? 'الطرف الآخر'}
        </Text>
      </View>
      <Text style={[styles.phone, { color: scheme.text }]}>{formatPhoneForDisplay(otherPhone)}</Text>
      <View style={styles.actions}>
        <View style={styles.actionBtn}>
          <AppButton
            title="اتصال"
            variant="primary"
            size="md"
            onPress={() => void Linking.openURL(`tel:${otherPhone}`)}
          />
        </View>
        <View style={styles.actionBtn}>
          <AppButton
            title="واتساب"
            variant="secondary"
            size="md"
            onPress={() => void Linking.openURL(`https://wa.me/${digits}`)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.md,
    borderWidth: 1,
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: FontSizes.base, fontWeight: FontWeights.bold },
  note: { fontSize: FontSizes.sm, flex: 1 },
  phone: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, textAlign: 'left', writingDirection: 'ltr' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionBtn: { flex: 1 },
});
