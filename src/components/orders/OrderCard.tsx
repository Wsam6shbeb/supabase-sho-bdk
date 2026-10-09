// ===============================================================
// شرح الملف: هذا مكوّن مرتبط بالطلبات/المحادثات (OrderCard).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: OrderCard، getStatusBadge.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import {
    Colors,
    FontSizes,
    FontWeights,
    Radii,
    Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { OrderStatus } from '@/types/common';
import type { Order } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

interface OrderCardProps {
  order: Order;
  onOpenChat?: (orderId: string) => void;
  onRate?: (orderId: string) => void;
  onViewDetails?: (orderId: string) => void;
  onReport?: (orderId: string) => void;
}

// [شرح الدالة: OrderCard] يعرض بطاقة الطلب ومعلومات حالته والإجراءات المرتبطة به.
export function OrderCard({
  order,
  onOpenChat,
  onRate,
  onViewDetails,
  onReport,
}: OrderCardProps) {
  const theme = useTheme();
  const scheme = Colors[theme];

// [شرح الدالة: getStatusBadge] يحدد النص أو الشارة المناسبة لعرض حالة العنصر.
  const getStatusBadge = () => {
    switch (order.status) {
      case OrderStatus.POSTED:
        return {
          text: t('orders.myOrders.postedBadge'),
          color: scheme.textSecondary,
          bg: `${scheme.textTertiary}15`,
          icon: 'reader-outline' as const,
        };
      case OrderStatus.AWAITING_AGREEMENT:
        return {
          text: t('orders.myOrders.awaitingAgreementBadge'),
          color: scheme.warning,
          bg: `${scheme.warning}15`,
          icon: 'time-outline' as const,
        };
      case OrderStatus.ACTIVE:
        return {
          text: t('orders.myOrders.activeBadge'),
          color: scheme.success,
          bg: `${scheme.success}15`,
          icon: 'checkmark-circle-outline' as const,
        };
      case OrderStatus.COMPLETION_PENDING_RATING:
        return {
          text: t('orders.myOrders.completionPendingRatingBadge'),
          color: scheme.warning,
          bg: `${scheme.warning}15`,
          icon: 'star-outline' as const,
        };
      case OrderStatus.COMPLETED:
        return {
          text: t('orders.myOrders.completedBadge'),
          color: scheme.primary,
          bg: `${scheme.primary}15`,
          icon: 'checkmark-done-circle-outline' as const,
        };
      case OrderStatus.CANCELLED:
        return {
          text: t('orders.myOrders.cancelledBadge'),
          color: scheme.danger,
          bg: `${scheme.danger}15`,
          icon: 'close-circle-outline' as const,
        };
      case OrderStatus.NOT_EXECUTED_REVIEW:
        return {
          text: t('orders.myOrders.notExecutedReviewBadge'),
          color: scheme.danger,
          bg: `${scheme.danger}15`,
          icon: 'alert-circle-outline' as const,
        };
    }
  };

  const badge = getStatusBadge();
  const canRate =
    (order.status === OrderStatus.COMPLETION_PENDING_RATING ||
      order.status === OrderStatus.NOT_EXECUTED_REVIEW) &&
    !order.customer_rating &&
    !!order.provider_id;
  const canChat = order.status === OrderStatus.ACTIVE && !!order.provider_id;
  const canReport =
    order.status === OrderStatus.COMPLETION_PENDING_RATING ||
    order.status === OrderStatus.COMPLETED;

  return (
    <AppCard padding="four" elevation="md" style={styles.card}>
      {/* Header: رقم الطلب + الحالة */}
      <View style={styles.header}>
        <Text style={[styles.orderNumber, { color: scheme.textTertiary }]}>
          {t('orders.myOrders.orderNumber')} #{order.id.slice(-6)}
        </Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.icon} size={14} color={badge.color} />
          <Text style={[styles.badgeText, { color: badge.color }]}>
            {badge.text}
          </Text>
        </View>
      </View>

      {/* الوصف */}
      <Text
        style={[styles.description, { color: scheme.text }]}
        numberOfLines={2}
      >
        {order.description}
      </Text>

      {/* شارات إضافية */}
      <View style={styles.tagsRow}>
        {order.is_urgent && (
          <View style={[styles.tag, { backgroundColor: `${scheme.urgent}15` }]}>
            <Ionicons name="flash" size={12} color={scheme.urgent} />
            <Text style={[styles.tagText, { color: scheme.urgent }]}>
              {t('orders.myOrders.urgentBadge')}
            </Text>
          </View>
        )}

        {order.provider_name && (
          <View style={styles.providerRow}>
            <Ionicons name="person" size={14} color={scheme.textSecondary} />
            <Text style={[styles.providerText, { color: scheme.textSecondary }]}>
              {order.my_role === 'provider' ? 'مع الزبون' : t('orders.myOrders.withProvider')} {order.other_user_name ?? order.provider_name}
            </Text>
          </View>
        )}
      </View>

      {/* السعر المتفق عليه — لا نعرض أي معلومات عن العمولة للزبون */}
      {order.agreed_price && (
        <View style={[styles.priceRow, { borderTopColor: scheme.border }]}>
          <View style={styles.priceItem}>
            <Text style={[styles.priceLabel, { color: scheme.textSecondary }]}>
              {t('orders.myOrders.agreedPrice')}
            </Text>
            <Text style={[styles.priceValue, { color: scheme.text }]}>
              {order.agreed_price} ل.س
            </Text>
          </View>
        </View>
      )}

      {/* التقييم (إن وُجد) */}
      {order.customer_rating && (
        <View style={styles.ratingDisplay}>
          <Ionicons name="star" size={16} color={scheme.warning} />
          <Text style={[styles.ratingText, { color: scheme.text }]}>
            {order.customer_rating}/5
          </Text>
          {order.customer_comment && (
            <Text
              style={[styles.ratingComment, { color: scheme.textSecondary }]}
              numberOfLines={1}
            >
              "{order.customer_comment}"
            </Text>
          )}
        </View>
      )}

      {/* الأزرار */}
      <View style={styles.actions}>
        {canChat && onOpenChat && (
          <AppButton
            title={t('orders.myOrders.actions.openActive')}
            variant="primary"
            size="md"
            onPress={() => onOpenChat(order.id)}
            style={{ flex: 1 }}
            leadingIcon={
              <Ionicons
                name="briefcase-outline"
                size={16}
                color={scheme.primaryContrast}
              />
            }
          />
        )}

        {canRate && onRate && (
          <AppButton
            title={t('orders.myOrders.actions.rateNow')}
            variant="primary"
            size="md"
            onPress={() => onRate(order.id)}
            style={{ flex: 1 }}
            leadingIcon={
              <Ionicons
                name="star"
                size={16}
                color={scheme.primaryContrast}
              />
            }
          />
        )}

        {(order.status === OrderStatus.COMPLETION_PENDING_RATING ||
          order.status === OrderStatus.COMPLETED) && onViewDetails && (
          <AppButton
            title={t('orders.myOrders.actions.viewDetails')}
            variant="secondary"
            size="md"
            onPress={() => onViewDetails(order.id)}
            style={{ flex: 1 }}
          />
        )}
      </View>

      {/* الإبلاغ */}
      {canReport && onReport && (
        <AppButton
          title={t('orders.myOrders.actions.report')}
          variant="ghost"
          size="sm"
          onPress={() => onReport(order.id)}
          leadingIcon={
            <Ionicons name="flag-outline" size={14} color={scheme.danger} />
          }
        />
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  orderNumber: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
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
  description: {
    fontSize: FontSizes.base,
    lineHeight: FontSizes.lg + 2,
    writingDirection: 'rtl',
    textAlign: 'right',
    marginBottom: Spacing.three,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radii.sm,
  },
  tagText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  providerText: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    marginBottom: Spacing.three,
  },
  priceItem: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginBottom: Spacing.one,
  },
  priceValue: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.three,
  },
  ratingText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
  ratingComment: {
    flex: 1,
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});