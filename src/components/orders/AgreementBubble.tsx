// ===============================================================
// شرح الملف: هذا مكوّن مرتبط بالطلبات/المحادثات (AgreementBubble).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: AgreementBubble، handleApprove، handleReject.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface AgreementBubbleProps {
  customerName: string;
  agreedPrice: number | null;
  commissionAmount: number;
  remainingSeconds?: number;
  onApprove: () => void;
  onReject: () => void;
  onSharePhoneChange?: (share: boolean) => void;
}

// [شرح الدالة: AgreementBubble] يعرض رسالة الاتفاق داخل المحادثة والإجراءات المرتبطة بالموافقة أو الرفض.
export function AgreementBubble({
  customerName,
  agreedPrice,
  commissionAmount,
  remainingSeconds,
  onApprove,
  onReject,
  onSharePhoneChange,
}: AgreementBubbleProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [sharePhone, setSharePhone] = useState(false);
  const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null);

// [شرح الدالة: handleApprove] يعالج موافقة المستخدم على الاتفاق الحالي وينفذ الخطوة التالية في سير الطلب.
  const handleApprove = () => {
    setDecided('approved');
    onSharePhoneChange?.(sharePhone);
    onApprove();
  };

// [شرح الدالة: handleReject] يعالج رفض الاتفاق الحالي ويحدث حالة الطلب/المحادثة وفقًا لذلك.
  const handleReject = () => {
    setDecided('rejected');
    onReject();
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.card,
          { backgroundColor: `${scheme.primary}10`, borderColor: `${scheme.primary}40` },
        ]}
      >
        <View style={styles.header}>
          <Ionicons name="checkmark-done-circle" size={22} color={scheme.primary} />
          <Text style={[styles.title, { color: scheme.primary }]}>
            {t('orders.chat.providerApprovalTitle')}
          </Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: scheme.textSecondary }]}>قيمة الخدمة</Text>
            <Text style={[styles.summaryValue, { color: scheme.text }]}>{agreedPrice != null ? `${agreedPrice} ل.س` : 'غير محددة'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: scheme.textSecondary }]}>العمولة المتوقعة</Text>
            <Text style={[styles.summaryValue, { color: scheme.text }]}>{commissionAmount} ل.س</Text>
          </View>
        </View>

        <Text style={[styles.body, { color: scheme.text }]}>
          {t('orders.chat.providerApprovalBody', { name: customerName, commission: commissionAmount })}
        </Text>

        {remainingSeconds != null && (
          <View style={[styles.countdown, { backgroundColor: `${scheme.warning}15` }]}>
            <Ionicons name="time-outline" size={18} color={scheme.warning} />
            <Text style={[styles.countdownText, { color: scheme.warning }]}>
              {t('orders.chat.waitingSeconds', { seconds: remainingSeconds })}
            </Text>
          </View>
        )}

        {decided === null ? (
          <>
            <Pressable
              onPress={() => {
                const next = !sharePhone;
                setSharePhone(next);
                onSharePhoneChange?.(next);
              }}
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: sharePhone ? scheme.primary : scheme.border,
                    backgroundColor: sharePhone ? scheme.primary : 'transparent',
                  },
                ]}
              >
                {sharePhone && (
                  <Ionicons name="checkmark" size={14} color={scheme.primaryContrast} />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: scheme.text }]}>
                {t('orders.chat.sharePhoneLabel')}
              </Text>
            </Pressable>

            <View style={styles.actions}>
              <AppButton
                title={t('orders.chat.approveBtn')}
                variant="primary"
                size="md"
                onPress={handleApprove}
                fullWidth={false}
                style={{ flex: 1 }}
                leadingIcon={
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={scheme.primaryContrast}
                  />
                }
              />
              <AppButton
                title={t('orders.chat.rejectBtn')}
                variant="secondary"
                size="md"
                onPress={handleReject}
                fullWidth={false}
                style={{ flex: 1, marginStart: Spacing.two }}
                leadingIcon={
                  <Ionicons name="close" size={18} color={scheme.text} />
                }
              />
            </View>
          </>
        ) : (
          <View
            style={[
              styles.decidedBadge,
              {
                backgroundColor:
                  decided === 'approved' ? `${scheme.success}15` : `${scheme.danger}15`,
              },
            ]}
          >
            <Ionicons
              name={decided === 'approved' ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={decided === 'approved' ? scheme.success : scheme.danger}
            />
            <Text
              style={[
                styles.decidedText,
                { color: decided === 'approved' ? scheme.success : scheme.danger },
              ]}
            >
              {decided === 'approved'
                ? t('orders.chat.approvedLabel')
                : t('orders.chat.rejectedLabel')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Radii.lg,
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  body: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.base + 6,
    writingDirection: 'rtl',
    textAlign: 'right',
    marginBottom: Spacing.three,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Radii.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  summary: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: FontSizes.sm, writingDirection: 'rtl' },
  summaryValue: { fontSize: FontSizes.base, fontWeight: FontWeights.bold, writingDirection: 'rtl' },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radii.md,
    marginBottom: Spacing.three,
  },
  countdownText: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, writingDirection: 'rtl' },
  decidedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radii.md,
  },
  decidedText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
});