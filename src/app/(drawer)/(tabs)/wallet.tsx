// ===============================================================
// شرح الملف: هذا صفحة المحفظة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: WalletTab، handleTopUp، handleSupport، TransactionRow.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة الرصيد
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import type { Transaction } from '@/types/wallet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: WalletTab] يعرض رصيد المستخدم وحركات المحفظة والإجراءات المرتبطة بها.
export default function WalletTab() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const {
    balance,
    transactions,
    isLowBalance,
    isCriticalBalance,
    topUp,
  } = useOrder();

// [شرح الدالة: handleTopUp] يعالج طلب شحن/إضافة رصيد إلى المحفظة (عبر السيرفر).
  const runTopUp = async (method: string) => {
    const result = await topUp(5000, method);
    if (!result.ok) {
      Alert.alert(t('wallet.topUpTitle'), result.error ?? 'تعذر إضافة الرصيد. حاول مرة أخرى.');
    }
  };

  const handleTopUp = () => {
    Alert.alert(
      t('wallet.topUpTitle'),
      t('wallet.topUpSubtitle'),
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'شام كاش', onPress: () => void runTopUp('شام كاش') },
        { text: 'سيرياتيل كاش', onPress: () => void runTopUp('سيرياتيل كاش') },
      ],
    );
  };

// [شرح الدالة: handleSupport] ينقل المستخدم إلى قناة الدعم المرتبطة بالمحفظة.
  const handleSupport = () => {
    Alert.alert('الدعم', 'سيتم التواصل معك قريباً');
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(drawer)/profile')} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={scheme.primary} />
        </Pressable>
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

              <View style={styles.actionsRow}>
                <AppButton
                  title={t('wallet.topUpBtn')}
                  variant="primary"
                  size="md"
                  onPress={handleTopUp}
                  fullWidth={false}
                  style={{ flex: 1 }}
                  leadingIcon={
                    <Ionicons name="add-circle" size={18} color={scheme.primaryContrast} />
                  }
                />
                <AppButton
                  title={t('wallet.supportBtn')}
                  variant="secondary"
                  size="md"
                  onPress={handleSupport}
                  fullWidth={false}
                  style={{ flex: 1, marginStart: Spacing.two }}
                  leadingIcon={
                    <Ionicons name="headset" size={18} color={scheme.text} />
                  }
                />
              </View>
            </AppCard>

            {transactions.length > 0 && (
              <Text style={[styles.sectionTitle, { color: scheme.text }]}>
                {t('wallet.transactionsTitle')}
              </Text>
            )}
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
  actionsRow: {
    flexDirection: 'row',
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