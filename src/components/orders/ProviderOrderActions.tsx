// ===============================================================
// أزرار المزود بعد موافقته على الاتفاق: "أنهيت الخدمة" و"إبلاغ عن مشكلة".
// القواعد (من يستطيع ماذا ومتى) تأتي من السيرفر عبر ConversationRatingStatus.
// ===============================================================
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { providerFinishService } from '@/services/orderActions';
import type { ConversationRatingStatus } from '@/services/orders';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  status: ConversationRatingStatus | null;
  onChanged: () => void;
}

export function ProviderOrderActions({ status, onChanged }: Props) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [busy, setBusy] = useState(false);

  if (!status?.is_provider) return null;

  const showFinish = status.can_finish;
  const waitingCustomer = status.provider_finished && status.request_state === 'active';
  const showReportLink = status.can_report;
  const reported = status.i_reported;

  if (!showFinish && !waitingCustomer && !showReportLink && !reported) return null;

  const handleFinish = () => {
    if (busy) return;
    Alert.alert(
      'إنهاء الخدمة',
      'هل أنهيت الخدمة فعلاً؟ سيصل الزبون إشعار لتأكيدها، وإن لم يرد يُعتمد الطلب تلقائياً بعد المهلة.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، أنهيتها',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const result = await providerFinishService(status.request_id);
              setBusy(false);
              if (!result.ok) {
                Alert.alert('', result.error);
                return;
              }
              onChanged();
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.box, { backgroundColor: scheme.backgroundElevated, borderColor: scheme.border }]}>
      {showFinish ? (
        <AppButton title="أنهيت الخدمة" variant="primary" size="md" onPress={handleFinish} loading={busy} disabled={busy} />
      ) : null}

      {waitingCustomer ? (
        <Text style={[styles.note, { color: scheme.textSecondary }]}>
          أنهيت الخدمة. بانتظار تأكيد الزبون، ويُعتمد الطلب تلقائياً إن لم يرد.
        </Text>
      ) : null}

      {reported ? (
        <Text style={[styles.note, { color: scheme.textSecondary }]}>تم إرسال بلاغك. سنتحقق من المشكلة ونتواصل معك.</Text>
      ) : showReportLink ? (
        <View style={styles.reportWrap}>
          <Text style={[styles.hint, { color: scheme.textSecondary }]}>
            في حال إساءة الاستخدام يرجى الإبلاغ عن الطرف الآخر.
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: '/orders/report-problem', params: { request_id: status.request_id } })}
            hitSlop={10}
          >
            <Text style={[styles.link, { color: scheme.textSecondary }]}>إبلاغ عن مشكلة</Text>
          </Pressable>
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
  note: { fontSize: FontSizes.sm, textAlign: 'center' },
  reportWrap: { alignItems: 'center', gap: Spacing.one },
  hint: { fontSize: FontSizes.xs, textAlign: 'center' },
  link: { fontSize: FontSizes.xs, textDecorationLine: 'underline', opacity: 0.8 },
});
