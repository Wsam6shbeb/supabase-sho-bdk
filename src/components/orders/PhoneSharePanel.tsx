// ===============================================================
// بطاقة مشاركة الرقم داخل المحادثة.
//  - خانة "شارك رقمي" وقت الاتفاق تسجّل القرار مسبقاً.
//  - بعد تأكيد الاتفاق (أي بعد خصم العمولة) يظهر زر "شارك رقمي" لمن لم يشارك بعد.
//  - رقم الطرف الآخر يظهر فقط إذا شاركه والاتفاق فعّال (مع اتصال/واتساب).
// ===============================================================
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { formatPhoneForDisplay } from '@/domain/phone';
import { useTheme } from '@/hooks/use-theme';
import { fetchPhoneShareStatus, sharePhone, type PhoneShareStatus } from '@/services/phone';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

interface Props {
  conversationId?: string | null;
  /** يتغير عند وصول رسالة نظام جديدة (مثل الموافقة على الاتفاق) فنعيد تحميل الحالة. */
  refreshKey?: string | null;
}

export function PhoneSharePanel({ conversationId, refreshKey }: Props) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [loadedStatus, setLoadedStatus] = useState<{ conversationId: string; status: PhoneShareStatus | null } | null>(null);
  const status = loadedStatus && loadedStatus.conversationId === conversationId ? loadedStatus.status : null;
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!conversationId) {
      setLoadedStatus(null);
      return;
    }
    setLoadedStatus({ conversationId, status: await fetchPhoneShareStatus(conversationId) });
  }, [conversationId]);

  useEffect(() => {
    let alive = true;
    if (!conversationId) return;
    void fetchPhoneShareStatus(conversationId).then((s) => {
      if (alive) setLoadedStatus({ conversationId, status: s });
    });
    return () => {
      alive = false;
    };
  }, [conversationId, refreshKey]);

  if (!status?.available) return null;

  const isActive = status.agreement_state === 'active';
  const otherPhone = status.other_shared ? status.other_phone : null;
  // الزر يظهر فقط بعد تأكيد الاتفاق (العمولة تُخصم عند موافقة مقدم الخدمة)
  const canShareNow = isActive && !status.i_shared;

  if (!otherPhone && !status.i_shared && !canShareNow) return null;

  const handleShare = () => {
    if (!conversationId || busy) return;
    Alert.alert('مشاركة رقمك', 'سيظهر رقم هاتفك للطرف الآخر في هذه المحادثة. هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'شارك رقمي',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const result = await sharePhone(conversationId);
            setBusy(false);
            if (!result.ok) {
              Alert.alert('', result.error ?? 'تعذرت مشاركة الرقم.');
              return;
            }
            await reload();
          })();
        },
      },
    ]);
  };

  const digits = otherPhone ? otherPhone.replace(/\D/g, '') : '';

  return (
    <View style={[styles.box, { backgroundColor: scheme.backgroundElevated, borderColor: scheme.border }]}>
      {otherPhone ? (
        <>
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
        </>
      ) : null}

      {canShareNow ? (
        <View style={styles.shareRow}>
          <Text style={[styles.note, { color: scheme.textSecondary }]}>
            تم تأكيد الاتفاق. يمكنك مشاركة رقم هاتفك مع الطرف الآخر للتنسيق.
          </Text>
          <AppButton
            title="شارك رقمي"
            variant={otherPhone ? 'secondary' : 'primary'}
            size="md"
            onPress={handleShare}
            loading={busy}
            disabled={busy}
          />
        </View>
      ) : null}

      {status.i_shared ? (
        <View style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={18} color={scheme.textSecondary} />
          <Text style={[styles.note, { color: scheme.textSecondary }]}>
            {isActive ? 'رقمك مشارَك مع الطرف الآخر.' : 'سيصل رقمك للطرف الآخر عند تأكيد الاتفاق.'}
          </Text>
        </View>
      ) : null}
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
  shareRow: { gap: Spacing.two },
  title: { fontSize: FontSizes.base, fontWeight: FontWeights.bold },
  note: { fontSize: FontSizes.sm, flex: 1 },
  phone: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, textAlign: 'left', writingDirection: 'ltr' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionBtn: { flex: 1 },
});
