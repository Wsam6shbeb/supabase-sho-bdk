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

  const otherParty = order.other_user_name
    ?? order.provider_name
    ?? (order.my_role === 'provider' ? order.customer_name : null)
    ?? 'غير محدد';

  return (
    <ScreenSafeArea style={[styles.safe, { backgroundColor: scheme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: scheme.text }]}>تفاصيل الطلب</Text>
        <AppButton title="رجوع" variant="secondary" size="sm" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.label, { color: scheme.textSecondary }]}>رقم الطلب</Text>
          <Text style={[styles.value, { color: scheme.text }]}>#{order.id.slice(-6)}</Text>
          <View style={[styles.separator, { backgroundColor: scheme.border }]} />
          <Text style={[styles.label, { color: scheme.textSecondary }]}>حالة الطلب</Text>
          <Text style={[styles.value, { color: scheme.primary }]}>{getStatusLabel(order.status)}</Text>
        </AppCard>

        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: scheme.text }]}>وصف الخدمة</Text>
          <Text style={[styles.description, { color: scheme.text }]}>{order.description || 'لا يوجد وصف'}</Text>
          {order.is_urgent && (
            <View style={styles.urgentRow}>
              <Ionicons name="alert-circle" size={18} color={scheme.danger} />
              <Text style={[styles.urgentText, { color: scheme.danger }]}>طلب مستعجل</Text>
            </View>
          )}
        </AppCard>

        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: scheme.text }]}>معلومات الاتفاق</Text>
          <Text style={[styles.label, { color: scheme.textSecondary }]}>السعر المتفق عليه</Text>
          <Text style={[styles.value, { color: scheme.text }]}>
            {order.agreed_price != null ? `${order.agreed_price.toLocaleString('en-US')} ل.س` : 'لم يُحدّد بعد'}
          </Text>
          <View style={[styles.separator, { backgroundColor: scheme.border }]} />
          <Text style={[styles.label, { color: scheme.textSecondary }]}>
            {order.my_role === 'provider' ? 'الزبون' : 'مقدم الخدمة'}
          </Text>
          <Text style={[styles.value, { color: scheme.text }]}>{otherParty}</Text>
        </AppCard>

        <AppCard padding="four" elevation="sm" style={styles.card}>
          <Text style={[styles.label, { color: scheme.textSecondary }]}>تاريخ إنشاء الطلب</Text>
          <Text style={[styles.value, { color: scheme.text }]}>{formatDate(order.created_at)}</Text>
          {order.completed_at && (
            <>
              <View style={[styles.separator, { backgroundColor: scheme.border }]} />
              <Text style={[styles.label, { color: scheme.textSecondary }]}>تاريخ إكمال الخدمة</Text>
              <Text style={[styles.value, { color: scheme.text }]}>{formatDate(order.completed_at)}</Text>
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
  content: { padding: Spacing.four, paddingTop: 0, paddingBottom: Spacing.eight, gap: Spacing.three },
  card: { marginBottom: Spacing.one },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, marginBottom: Spacing.three, textAlign: 'right' },
  label: { fontSize: FontSizes.sm, marginBottom: Spacing.one, textAlign: 'right' },
  value: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, textAlign: 'right' },
  description: { fontSize: FontSizes.md, lineHeight: 25, textAlign: 'right' },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.three },
  urgentRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.three },
  urgentText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
});