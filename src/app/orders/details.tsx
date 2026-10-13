// شاشة مستقلة لعرض تفاصيل الطلب؛ لا تعدّل حالة الطلب ولا التقييم.
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { OrderStatus } from '@/types/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.POSTED: return 'بانتظار مقدمي الخدمة';
    case OrderStatus.AWAITING_AGREEMENT: return 'بانتظار الاتفاق';
    case OrderStatus.ACTIVE: return 'قيد التنفيذ';
    case OrderStatus.COMPLETION_PENDING_RATING: return 'بانتظار التقييم';
    case OrderStatus.COMPLETED: return 'مكتمل';
    case OrderStatus.CANCELLED: return 'ملغي';
    case OrderStatus.NOT_EXECUTED_REVIEW: return 'قيد مراجعة عدم التنفيذ';
    default: return 'غير معروف';
  }
}

export default function OrderDetailsScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams<{ order_id?: string }>();
  const { getOrderById, orderHistory } = useOrder();
  const orderId = params.order_id;
  const order = (orderId ? getOrderById(orderId) : undefined)
    ?? orderHistory.find((item) => item.id === orderId);

  const formatDate = (value?: string | null) => {
    if (!value) return 'غير متوفر';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'غير متوفر' : date.toLocaleString('ar-SY');
  };

  if (!order) {
    return (
      <ScreenSafeArea style={[styles.safe, { backgroundColor: scheme.background }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={54} color={scheme.danger} />
          <Text style={[styles.title, { color: scheme.text }]}>الطلب غير موجود</Text>
          <AppButton title="رجوع" variant="primary" size="md" onPress={() => router.back()} />
        </View>
      </ScreenSafeArea>
    );
  }

  const isProvider = order.my_role === 'provider';
  const myRoleLabel = isProvider ? 'أنت مقدّم الخدمة' : 'أنت طالب الخدمة';
  const otherRoleLabel = isProvider ? 'طالب الخدمة' : 'مقدّم الخدمة';
  const otherParty = order.other_user_name
    ?? (isProvider ? order.customer_name : order.provider_name)
    ?? 'غير محدد';

  return (
    <ScreenSafeArea style={[styles.safe, { backgroundColor: scheme.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.title, { color: scheme.text }]}>تفاصيل الطلب</Text>
          <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>ملخص الخدمة والاتفاق</Text>
        </View>
        <AppButton title="رجوع" variant="secondary" size="sm" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppCard padding="four" elevation="sm" style={styles.card}>
          <View style={styles.orderTop}>
            <View style={[styles.orderIcon, { backgroundColor: scheme.primary + '18' }]}>
              <Ionicons name="document-text-outline" size={25} color={scheme.primary} />
            </View>
            <View style={styles.orderNumberWrap}>
              <Text style={[styles.label, { color: scheme.textSecondary }]}>رقم الطلب</Text>
              <Text style={[styles.orderNumber, { color: scheme.text }]}>#{order.id.slice(-6)}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: scheme.primary + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: scheme.primary }]} />
            <Text style={[styles.statusText, { color: scheme.primary }]}>{getStatusLabel(order.status)}</Text>
          </View>
          <View style={[styles.separator, { backgroundColor: scheme.border }]} />
          <View style={styles.roleRow}>
            <Ionicons name={isProvider ? 'construct-outline' : 'person-outline'} size={21} color={scheme.primary} />
            <View style={styles.roleTextWrap}>
              <Text style={[styles.label, { color: scheme.textSecondary }]}>دورك بهذا الطلب</Text>
              <Text style={[styles.value, { color: scheme.text }]}>{myRoleLabel}</Text>
            </View>
          </View>
        </AppCard>

        <AppCard padding="four" elevation="sm" style={styles.card}>
          <View style={styles.sectionHeading}>
            <Ionicons name="reader-outline" size={21} color={scheme.primary} />
            <Text style={[styles.sectionTitle, { color: scheme.text }]}>وصف الخدمة</Text>
          </View>
          <Text style={[styles.description, { color: scheme.text }]}>{order.description || 'لا يوجد وصف للخدمة.'}</Text>
          {order.is_urgent && (
            <View style={[styles.urgentBadge, { backgroundColor: scheme.danger + '14' }]}>
              <Ionicons name="alert-circle" size={18} color={scheme.danger} />
              <Text style={[styles.urgentText, { color: scheme.danger }]}>طلب مستعجل</Text>
            </View>
          )}
        </AppCard>

        <AppCard padding="four" elevation="sm" style={styles.card}>
          <View style={styles.sectionHeading}>
            <Ionicons name="people-outline" size={21} color={scheme.primary} />
            <Text style={[styles.sectionTitle, { color: scheme.text }]}>الأطراف والاتفاق</Text>
          </View>
          <View style={[styles.personPanel, { backgroundColor: scheme.background, borderColor: scheme.border }]}>
            <View style={[styles.personIcon, { backgroundColor: scheme.primary + '18' }]}>
              <Ionicons name={isProvider ? 'person-outline' : 'construct-outline'} size={22} color={scheme.primary} />
            </View>
            <View style={styles.personInfo}>
              <Text style={[styles.label, { color: scheme.textSecondary }]}>{otherRoleLabel}</Text>
              <Text style={[styles.value, { color: scheme.text }]}>{otherParty}</Text>
            </View>
          </View>
          <View style={[styles.pricePanel, { borderColor: scheme.border }]}>
            <View>
              <Text style={[styles.label, { color: scheme.textSecondary }]}>السعر المتفق عليه</Text>
              <Text style={[styles.priceValue, { color: scheme.primary }]}>
                {order.agreed_price != null ? `${order.agreed_price.toLocaleString('en-US')} ل.س` : 'لم يُحدّد بعد'}
              </Text>
            </View>
            <Ionicons name="cash-outline" size={26} color={scheme.primary} />
          </View>
        </AppCard>

        <AppCard padding="four" elevation="sm" style={styles.card}>
          <View style={styles.sectionHeading}>
            <Ionicons name="calendar-outline" size={21} color={scheme.primary} />
            <Text style={[styles.sectionTitle, { color: scheme.text }]}>التواريخ</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={[styles.dateValue, { color: scheme.text }]}>{formatDate(order.created_at)}</Text>
            <Text style={[styles.label, { color: scheme.textSecondary }]}>تاريخ إنشاء الطلب</Text>
          </View>
          {order.completed_at && (
            <>
              <View style={[styles.separator, { backgroundColor: scheme.border }]} />
              <View style={styles.dateRow}>
                <Text style={[styles.dateValue, { color: scheme.text }]}>{formatDate(order.completed_at)}</Text>
                <Text style={[styles.label, { color: scheme.textSecondary }]}>تاريخ إكمال الخدمة</Text>
              </View>
            </>
          )}
        </AppCard>
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerTitleWrap: { alignItems: 'flex-end', gap: Spacing.one },
  subtitle: { fontSize: FontSizes.sm },
  content: { padding: Spacing.four, paddingTop: 0, paddingBottom: Spacing.eight, gap: Spacing.three },
  card: { marginBottom: Spacing.one },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  orderTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.three },
  orderIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  orderNumberWrap: { alignItems: 'flex-end', gap: Spacing.one },
  orderNumber: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  statusPill: { alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.two, borderRadius: 18, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, marginTop: Spacing.four },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold },
  roleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.three },
  roleTextWrap: { flex: 1, alignItems: 'flex-end', gap: Spacing.one },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, textAlign: 'right' },
  label: { fontSize: FontSizes.sm, marginBottom: Spacing.one, textAlign: 'right' },
  value: { fontSize: FontSizes.base, fontWeight: FontWeights.semibold, textAlign: 'right' },
  description: { fontSize: FontSizes.base, lineHeight: 26, textAlign: 'right' },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.three },
  urgentBadge: { alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.one, borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, marginTop: Spacing.three },
  urgentText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  personPanel: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: 14, padding: Spacing.three },
  personIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  personInfo: { flex: 1, alignItems: 'flex-end', gap: Spacing.one },
  pricePanel: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: Spacing.three, marginTop: Spacing.three },
  priceValue: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, textAlign: 'right' },
  dateRow: { gap: Spacing.one, alignItems: 'flex-end' },
  dateValue: { fontSize: FontSizes.base, fontWeight: FontWeights.semibold, textAlign: 'right' },
});
