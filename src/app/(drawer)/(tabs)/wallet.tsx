// ===============================================================
// شرح الملف: هذا صفحة المحفظة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: WalletTab، handleCopyCode، TransactionRow.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة الرصيد
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { Image } from 'expo-image';
import { getSupportContacts } from '@/services/support';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import type { Transaction } from '@/types/wallet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: WalletTab] يعرض رصيد المستخدم وحركات المحفظة والإجراءات المرتبطة بها.
export default function WalletTab() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user } = useAuth();
  const [paymentSettings, setPaymentSettings] = useState<{ accountCode: string; qrUrl: string; enabled: boolean } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);
  const {
    balance,
    transactions,
    isLowBalance,
    isCriticalBalance,
  } = useOrder();

  useEffect(() => {
    let active = true;
    void fetch('https://sho-bdk-dashboard.pages.dev/api/public-payment-settings')
      .then(async (response) => {
        if (!response.ok) throw new Error('تعذّر تحميل بيانات الشحن');
        return response.json();
      })
      .then((data) => {
        if (active) setPaymentSettings({
          accountCode: typeof data.accountCode === 'string' ? data.accountCode : '',
          qrUrl: typeof data.qrUrl === 'string' ? data.qrUrl : '',
          enabled: data.enabled === true,
        });
      })
      .catch(() => { if (active) setPaymentSettings(null); })
      .finally(() => { if (active) setPaymentLoading(false); });
    return () => { active = false; };
  }, []);

  const handleCopyCode = async () => {
    if (!user?.topup_code) return;
    try {
      await Clipboard.setStringAsync(user.topup_code);
      Alert.alert('تم النسخ', 'تم نسخ رمز الشحن إلى الحافظة.');
    } catch {
      Alert.alert('رمز الشحن', user.topup_code);
    }
  };

  const handleWhatsAppSupport = async () => {
    try {
      const contacts = await getSupportContacts();
      const rawPhone = contacts.phone.replace(/\D/g, '');
      const whatsappPhone = rawPhone.startsWith('00')
        ? rawPhone.slice(2)
        : rawPhone.startsWith('0')
          ? `963${rawPhone.slice(1)}`
          : rawPhone;

      if (!/^\d{8,15}$/.test(whatsappPhone)) {
        Alert.alert('رقم واتساب الدعم غير متوفر', 'يرجى المحاولة لاحقاً.');
        return;
      }

      const message = encodeURIComponent('مرحباً، أحتاج مساعدة بخصوص تعبئة الرصيد في تطبيق شو بدك.');
      await Linking.openURL(`https://wa.me/${whatsappPhone}?text=${message}`);
    } catch {
      Alert.alert('تعذر فتح واتساب', 'يرجى المحاولة لاحقاً.');
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        {/* التعليق لزر رجوع يعيدنا الى صفحة البروفايل */}
        {/* <GuardedPressable onPress={() => router.replace('/(drawer)/profile')} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={scheme.primary} />
        </GuardedPressable> */}
        <Text style={[styles.title, { color: scheme.text }]}>
          {t('wallet.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow tx={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <AppCard padding="four" elevation="md" style={styles.balanceCard}>
              <Text style={[styles.balanceLabel, { color: scheme.textSecondary }]}>
                {t('wallet.currentBalance')}
              </Text>
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceValue, { color: scheme.primary }]}>
                  {balance.toLocaleString()}
                </Text>
                <Text style={[styles.balanceCurrency, { color: scheme.textSecondary }]}>
                  ل.س
                </Text>
              </View>

              {isCriticalBalance && (
                <View
                  style={[
                    styles.alertBadge,
                    { backgroundColor: `${scheme.danger}15` },
                  ]}
                >
                  <Ionicons name="alert-circle" size={16} color={scheme.danger} />
                  <Text style={[styles.alertText, { color: scheme.danger }]}>
                    {t('wallet.criticalBalance')}
                  </Text>
                </View>
              )}

              {isLowBalance && !isCriticalBalance && (
                <View
                  style={[
                    styles.alertBadge,
                    { backgroundColor: `${scheme.warning}15` },
                  ]}
                >
                  <Ionicons name="warning" size={16} color={scheme.warning} />
                  <Text style={[styles.alertText, { color: scheme.warning }]}>
                    {t('wallet.lowBalance')}
                  </Text>
                </View>
              )}

            </AppCard>

            <AppCard padding="four" elevation="sm" style={styles.paymentCard}>
              <GuardedPressable
                onPress={() => setShowPaymentInstructions((current) => !current)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showPaymentInstructions }}
                style={[styles.paymentToggle, { backgroundColor: `${scheme.primary}12`, borderColor: `${scheme.primary}55` }]}
              >
                <Text style={[styles.paymentTitle, { color: scheme.text }]}>كيفية تعبئة الرصيد</Text>
                <Ionicons
                  name={showPaymentInstructions ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={scheme.primary}
                />
              </GuardedPressable>

              {showPaymentInstructions ? (
                <View style={styles.paymentDetails}>
                  {paymentLoading ? (
                    <Text style={[styles.paymentText, { color: scheme.textSecondary }]}>جارٍ تحميل بيانات الدفع…</Text>
                  ) : !paymentSettings?.enabled ? (
                    <Text style={[styles.paymentText, { color: scheme.textSecondary }]}>الشحن اليدوي غير متاح حالياً.</Text>
                  ) : (
                    <>
                      <View style={styles.instructionRow}><Text style={[styles.paymentText, styles.instructionText, { color: scheme.text }]}>طريقة الشحن:</Text></View>
                      <View style={styles.instructionRow}><Text style={[styles.instruction, styles.instructionText, { color: scheme.text }]}>١. حوّل المبلغ عبر شام كاش باستخدام رقم الحساب أو رمز QR.</Text></View>
                      <View style={styles.instructionRow}><Text style={[styles.instruction, styles.instructionText, styles.importantInstruction, { color: scheme.danger }]}>٢. اكتب رمز الشحن الخاص بك في ملاحظات الحوالة.</Text></View>
                      <View style={styles.instructionRow}><Text style={[styles.instruction, styles.instructionText, styles.importantInstruction, { color: scheme.danger }]}>٣. احتفظ بصورة إيصال التحويل.</Text></View>
                      <View style={styles.instructionRow}><Text style={[styles.instruction, styles.instructionText, { color: scheme.text }]}>٤. بعد التحويل، اضغط زر واتساب بالأسفل وأرسل صورة الإيصال للدعم.</Text></View>

                      {paymentSettings.qrUrl ? (
                        <>
                          <Text style={[styles.paymentText, { color: scheme.text }]}>رمز QR لحساب شام كاش</Text>
                          <Image source={{ uri: paymentSettings.qrUrl }} contentFit="contain" style={styles.qrImage} />
                        </>
                      ) : null}

                      <Text style={[styles.paymentText, { color: scheme.textSecondary }]}>رقم حساب شام كاش الخاص بالتطبيق</Text>
                      <Text selectable style={[styles.accountCode, { color: scheme.primary }]}>{paymentSettings.accountCode || 'غير متوفر حالياً'}</Text>

                      <View style={styles.codeBox}>
                        <View style={styles.codeTextWrap}>
                          <Text style={[styles.paymentText, { color: scheme.textSecondary }]}>رمز الشحن الخاص بك</Text>
                          <Text selectable style={[styles.accountCode, { color: scheme.text }]}>{user?.topup_code || 'سيظهر الرمز بعد تحديث بيانات الحساب'}</Text>
                        </View>
                        <AppButton
                          title="نسخ الرمز"
                          variant="primary"
                          size="md"
                          onPress={handleCopyCode}
                          fullWidth={false}
                          leadingIcon={<Ionicons name="copy-outline" size={17} color="#FFFFFF" />}
                        />
                      </View>

                      <AppButton
                        title="إرسال الإيصال عبر واتساب"
                        variant="secondary"
                        size="md"
                        onPress={handleWhatsAppSupport}
                        fullWidth
                        leadingIcon={<Ionicons name="logo-whatsapp" size={20} color={scheme.success} />}
                      />
                    </>
                  )}
                </View>
              ) : null}
            </AppCard>

            <Text style={[styles.sectionTitle, { color: scheme.text }]}>
              سجل المعاملات المالية
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="receipt-outline" size={64} color={scheme.textTertiary} />
            <Text style={[styles.emptyTitle, { color: scheme.text }]}>
              {t('wallet.emptyTransactions')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: scheme.textSecondary }]}>
              {t('wallet.emptyHint')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// [شرح الدالة: TransactionRow] يعرض حركة مالية واحدة داخل قائمة المعاملات.
function TransactionRow({ tx }: { tx: Transaction }) {
  const theme = useTheme();
  const scheme = Colors[theme];

  const isCredit = tx.type === 'credit';
  const color = isCredit ? scheme.success : scheme.danger;
  const sign = isCredit ? '+' : '-';

  const date = new Date(tx.created_at).toLocaleDateString('ar-SY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <AppCard padding="three" elevation="sm" style={styles.txCard}>
      <View style={styles.txRow}>
        <View
          style={[
            styles.txIcon,
            { backgroundColor: `${color}15` },
          ]}
        >
          <Ionicons
            name={isCredit ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={24}
            color={color}
          />
        </View>

        <View style={styles.txInfo}>
          <Text style={[styles.txDescription, { color: scheme.text }]}>
            {tx.description}
          </Text>
          {tx.counterparty_name && (
            <Text style={[styles.txMeta, { color: scheme.textSecondary }]}>
              مع {tx.counterparty_name}
            </Text>
          )}
          <Text style={[styles.txDate, { color: scheme.textTertiary }]}>
            {date}
          </Text>
        </View>

        <View style={styles.txAmount}>
          <Text style={[styles.txAmountText, { color }]}>
            {sign}{tx.amount}
          </Text>
          <Text style={[styles.txBalanceAfter, { color: scheme.textTertiary }]}>
            {tx.balance_after}
          </Text>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.six,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    flexGrow: 1,
  },
  balanceCard: {
    marginBottom: Spacing.four,
  },
  paymentCard: { marginBottom: Spacing.four },
  paymentToggle: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: Radii.md, borderWidth: 1, elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4 },
  paymentDetails: { gap: Spacing.three, paddingTop: Spacing.three, alignItems: 'stretch', direction: 'rtl' },
  paymentTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.extrabold, writingDirection: 'rtl' },
  paymentText: { fontSize: FontSizes.sm, writingDirection: 'rtl', textAlign: 'right' },
  accountCode: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, textAlign: 'center', letterSpacing: 1 },
  qrImage: { width: 190, height: 190, alignSelf: 'center', marginVertical: Spacing.two },
  instructionRow: { width: '100%', alignSelf: 'stretch', direction: 'rtl', alignItems: 'flex-end' },
  instructionText: { width: '100%', alignSelf: 'stretch', writingDirection: 'rtl', textAlign: 'right', textAlignVertical: 'center' },
  instruction: { width: '100%', alignSelf: 'stretch', fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, writingDirection: 'rtl', textAlign: 'right', lineHeight: 32 },
  importantInstruction: { fontWeight: FontWeights.bold },
  codeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, padding: Spacing.three, borderRadius: Radii.md, backgroundColor: '#F1F5F9' },
  codeTextWrap: { flex: 1, gap: 4 },
  balanceLabel: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  balanceValue: {
    fontSize: 42,
    fontWeight: FontWeights.extrabold,
  },
  balanceCurrency: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.md,
    marginBottom: Spacing.three,
  },
  alertText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
    flex: 1,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
    marginBottom: Spacing.three,
  },
  txCard: {
    marginBottom: Spacing.two,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txDescription: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  txMeta: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  txDate: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
  },
  txAmount: {
    alignItems: 'flex-end',
  },
  txAmountText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  txBalanceAfter: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.nine,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    marginTop: Spacing.four,
    writingDirection: 'rtl',
  },
  emptySubtitle: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.two,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
});