// ===============================================================
// شرح الملف: هذا صفحة الإشعارات.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: NotificationsScreen، handlePress، NotificationCard.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import type { AppNotification, NotificationType } from '@/types/notifications';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ViewStyle } from 'react-native';

// ═══════════════════════════════════════════════════════════
// أيقونة ولون لكل نوع إشعار
// ═══════════════════════════════════════════════════════════
const NOTIFICATION_CONFIG: Record<
  NotificationType,
  { icon: keyof typeof Ionicons.glyphMap; colorKey: 'primary' | 'success' | 'warning' | 'danger' | 'urgent' | 'textSecondary' }
> = {
  order_created: { icon: 'add-circle-outline', colorKey: 'primary' },
  candidate_found: { icon: 'people-outline', colorKey: 'primary' },
  agreement_confirmed: { icon: 'time-outline', colorKey: 'warning' },
  agreement_approved: { icon: 'checkmark-circle-outline', colorKey: 'success' },
  agreement_rejected: { icon: 'close-circle-outline', colorKey: 'danger' },
  order_completed: { icon: 'checkmark-done-circle-outline', colorKey: 'success' },
  new_message: { icon: 'chatbubble-outline', colorKey: 'primary' },
  rating_received: { icon: 'star-outline', colorKey: 'warning' },
  verification_approved: { icon: 'shield-checkmark-outline', colorKey: 'success' },
  verification_rejected: { icon: 'shield-outline', colorKey: 'danger' },
  balance_low: { icon: 'wallet-outline', colorKey: 'danger' },
  welcome_bonus: { icon: 'gift-outline', colorKey: 'warning' },
  rating_reminder: { icon: 'star-half-outline', colorKey: 'warning' },
  rating_auto_approved: { icon: 'checkmark-done-circle-outline', colorKey: 'textSecondary' },
};

// [شرح الدالة: NotificationsScreen] يعرض إشعارات المستخدم والإجراءات المرتبطة بها.
export default function NotificationsScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotification,
    clearAllNotifications,
    unreadNotificationsCount,
  } = useOrder();

  // ═══════════════════════════════════════════════════════════
  // الضغط على إشعار
  // ═══════════════════════════════════════════════════════════
// [شرح الدالة: handlePress] يعالج ضغط المستخدم على العنصر ويحدد الإجراء المناسب.
  const handlePress = (notif: AppNotification) => {
    markNotificationRead(notif.id);
    if (notif.route) {
      router.push(notif.route);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: scheme.text }]}>
          {t('notifications.title')}
        </Text>

        {notifications.length > 0 && (
          <View style={styles.headerActions}>
            {unreadNotificationsCount > 0 && (
              <Pressable onPress={markAllNotificationsRead} hitSlop={6}>
                <Text style={[styles.headerBtn, { color: scheme.primary }]}>
                  {t('notifications.markAllRead')}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={clearAllNotifications} hitSlop={6}>
              <Ionicons name="trash-outline" size={20} color={scheme.danger} />
            </Pressable>
          </View>
        )}
      </View>

      {/* List */}
      {notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons
            name="notifications-off-outline"
            size={64}
            color={scheme.textTertiary}
          />
          <Text style={[styles.emptyText, { color: scheme.text }]}>
            {t('notifications.empty')}
          </Text>
          <Text style={[styles.emptySubtext, { color: scheme.textSecondary }]}>
            {t('notifications.emptyHint')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onPress={() => handlePress(item)}
              onClear={() => clearNotification(item.id)}
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
// Notification Card
// ═══════════════════════════════════════════════════════════
// [شرح الدالة: NotificationCard] يعرض بطاقة إشعار واحدة.
function NotificationCard({
  notification,
  onPress,
  onClear,
}: {
  notification: AppNotification;
  onPress: () => void;
  onClear: () => void;
}) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const config = NOTIFICATION_CONFIG[notification.type];
  const color = scheme[config.colorKey];

  const date = new Date(notification.created_at).toLocaleString('ar-SY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Pressable onPress={onPress}>
      <AppCard
        padding="three"
        elevation={notification.read ? 'sm' : 'md'}
        style={StyleSheet.flatten([
          styles.card,
          !notification.read ? {
            borderLeftWidth: 4,
            borderLeftColor: color,
          } : {},
        ])}
      >
        <View style={styles.cardRow}>
          <View
            style={[styles.iconWrap, { backgroundColor: `${color}15` }]}
          >
            <Ionicons name={config.icon} size={22} color={color} />
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: scheme.text,
                    fontWeight: notification.read
                      ? FontWeights.medium
                      : FontWeights.bold,
                  },
                ]}
                numberOfLines={1}
              >
                {notification.title}
              </Text>
              {!notification.read && (
                <View style={[styles.unreadDot, { backgroundColor: color }]} />
              )}
            </View>

            <Text
              style={[styles.cardBody, { color: scheme.textSecondary }]}
              numberOfLines={2}
            >
              {notification.body}
            </Text>

            <Text style={[styles.cardDate, { color: scheme.textTertiary }]}>
              {date}
            </Text>
          </View>

          <Pressable onPress={onClear} hitSlop={6} style={styles.clearBtn}>
            <Ionicons name="close" size={18} color={scheme.textTertiary} />
          </Pressable>
        </View>
      </AppCard>
    </Pressable>
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
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  headerBtn: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  card: {
    marginBottom: Spacing.two,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  cardTitle: {
    flex: 1,
    fontSize: FontSizes.base,
    writingDirection: 'rtl',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
  },
  cardBody: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.base + 4,
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  cardDate: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
  },
  clearBtn: {
    padding: Spacing.one,
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
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.two,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
});