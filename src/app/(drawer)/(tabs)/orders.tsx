// ===============================================================
// شرح الملف: هذا صفحة الطلبات.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: OrdersTab، handleOpenChat، handleRate، handleViewDetails، handleReport، handleNewOrder، TabButton.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة طلباتي
// ═══════════════════════════════════════════════════════════

import { OrderCard } from '@/components/orders/OrderCard';
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { OrderStatus } from '@/types/common';
import type { Order } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TabKey = 'active' | 'awaitingRating' | 'previous';

// [شرح الدالة: OrdersTab] يعرض قائمة طلبات المستخدم وحالاتها والإجراءات المتاحة لكل طلب.
export default function OrdersTab() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { currentOrder, orderHistory } = useOrder();
  const [activeTab, setActiveTab] = useState<TabKey>('active');

  // النشطة
  const activeOrders = useMemo<Order[]>(() => {
    if (currentOrder && currentOrder.status === OrderStatus.ACTIVE) {
      return [currentOrder];
    }
    return [];
  }, [currentOrder]);

  // بانتظار التقييم
  const awaitingRatingOrders = useMemo<Order[]>(() => {
    return orderHistory.filter(
      (o) => o.status === OrderStatus.COMPLETION_PENDING_RATING && !o.customer_rating && o.provider_id,
    );
  }, [orderHistory]);

  // السابقة
  const previousOrders = useMemo<Order[]>(() => {
    return orderHistory.filter((o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.CANCELLED || o.status === OrderStatus.NOT_EXECUTED_REVIEW);
  }, [orderHistory]);

  // ═══════════════════════════════════════════════════════════
  // الأزرار
  // ═══════════════════════════════════════════════════════════
// [شرح الدالة: handleOpenChat] يفتح المحادثة مع مقدم الخدمة المختار.
  const handleOpenChat = (orderId: string) => {
    if (currentOrder?.id === orderId && currentOrder.provider_id) {
      router.push('/orders/active');
    }
  };

// [شرح الدالة: handleRate] ينقل المستخدم إلى تقييم الطلب المحدد.
  const handleRate = (orderId: string) => {
    router.push({
      pathname: '/orders/rate',
      params: { order_id: orderId },
    });
  };

// [شرح الدالة: handleViewDetails] يفتح تفاصيل الطلب المحدد.
  const handleViewDetails = (orderId: string) => {
    router.push({
      pathname: '/orders/rate',
      params: { order_id: orderId, readonly: 'true' },
    });
  };

  // ⭐ إبلاغ
// [شرح الدالة: handleReport] يفتح إجراء الإبلاغ المرتبط بالطلب.
  const handleReport = (orderId: string) => {
    const order = orderHistory.find((o) => o.id === orderId);
    if (!order?.other_user_id) return;

    router.push({
      pathname: '/orders/report',
      params: {
        reported_user_id: order.other_user_id,
        reported_user_name: order.other_user_name ?? 'المستخدم الآخر',
        order_id: orderId,
      },
    });
  };

// [شرح الدالة: handleNewOrder] يبدأ إنشاء طلب خدمة جديد.
  const handleNewOrder = () => {
    router.push('/orders/create');
  };

  // ═══════════════════════════════════════════════════════════
  const getCurrentData = (): Order[] => {
    switch (activeTab) {
      case 'active':
        return activeOrders;
      case 'awaitingRating':
        return awaitingRatingOrders;
      case 'previous':
        return previousOrders;
    }
  };

  const getEmptyMessage = (): string => {
    switch (activeTab) {
      case 'active':
        return t('orders.myOrders.emptyActive');
      case 'awaitingRating':
        return t('orders.myOrders.emptyAwaiting');
      case 'previous':
        return t('orders.myOrders.emptyPrevious');
    }
  };

  const data = getCurrentData();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: scheme.text }]}>
          {t('orders.myOrders.title')}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: scheme.border }]}>
        <TabButton
          label={t('orders.myOrders.tabs.active')}
          active={activeTab === 'active'}
          count={activeOrders.length}
          onPress={() => setActiveTab('active')}
        />
        <TabButton
          label={t('orders.myOrders.tabs.awaitingRating')}
          active={activeTab === 'awaitingRating'}
          count={awaitingRatingOrders.length}
          onPress={() => setActiveTab('awaitingRating')}
        />
        <TabButton
          label={t('orders.myOrders.tabs.previous')}
          active={activeTab === 'previous'}
          count={previousOrders.length}
          onPress={() => setActiveTab('previous')}
        />
      </View>

      {/* List */}
      {data.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="reader-outline" size={64} color={scheme.textTertiary} />
          <Text style={[styles.emptyText, { color: scheme.text }]}>
            {getEmptyMessage()}
          </Text>
          <AppButton
            title={t('orders.myOrders.emptyHint')}
            variant="primary"
            size="lg"
            onPress={handleNewOrder}
            style={{ marginTop: Spacing.six }}
            leadingIcon={
              <Ionicons name="add" size={20} color={scheme.primaryContrast} />
            }
          />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onOpenChat={handleOpenChat}
              onRate={handleRate}
              onViewDetails={handleViewDetails}
              onReport={handleReport}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab Button
// ═══════════════════════════════════════════════════════════
interface TabButtonProps {
  label: string;
  active: boolean;
  count: number;
  onPress: () => void;
}

// [شرح الدالة: TabButton] يعرض زر تبويب قابل لإعادة الاستخدام ويطبق حالة التبويب النشط.
function TabButton({ label, active, count, onPress }: TabButtonProps) {
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabButton,
        active && { borderBottomColor: scheme.primary, borderBottomWidth: 3 },
      ]}
    >
      <Text
        style={[
          styles.tabLabel,
          {
            color: active ? scheme.primary : scheme.textSecondary,
            fontWeight: active ? FontWeights.bold : FontWeights.medium,
          },
        ]}
      >
        {label}
      </Text>
      {count > 0 && (
        <View
          style={[
            styles.tabBadge,
            { backgroundColor: active ? scheme.primary : scheme.backgroundElement },
          ]}
        >
          <Text
            style={[
              styles.tabBadgeText,
              { color: active ? scheme.primaryContrast : scheme.textSecondary },
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.six,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: Spacing.three,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  tabLabel: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: Spacing.one,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    marginTop: Spacing.four,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});