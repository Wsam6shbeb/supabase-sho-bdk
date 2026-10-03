// ===============================================================
// شرح الملف: هذا صفحة الرسائل.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: MessagesTab، handleOpenChat، handleRequestAgain، getStatusBadge.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة الرسائل
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { fetchMyConversations, subscribeToInbox, type InboxConversation } from '@/services/chat';
import { ChatStatus, OrderStatus } from '@/types/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: MessagesTab] يعرض قائمة المحادثات والرسائل المرتبطة بطلبات المستخدم.
export default function MessagesTab() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const {
    activeChats,
    allProviders,
    orderHistory,
    hasCompletedOrderWith,
  } = useOrder();

  // المحادثات الواردة: التي أنا فيها مقدم الخدمة (من Supabase مع تحديث لحظي)
  const [incoming, setIncoming] = useState<InboxConversation[]>([]);
  const loadInbox = useCallback(() => {
    void fetchMyConversations().then((rows) =>
      setIncoming(rows.filter((r) => r.my_role === 'provider')),
    );
  }, []);
  useEffect(() => {
    loadInbox();
    return subscribeToInbox(loadInbox);
  }, [loadInbox]);

  // دمج المحادثات النشطة + المكتملة
  const allThreads = [
    // نشطة
    ...activeChats.map((thread) => ({
      thread,
      provider: allProviders.find((p) => p.id === thread.provider_id),
      isCompleted: false,
    })),
  ].filter((x) => x.provider !== undefined);

  // المكتملة من orderHistory (بدون محادثة نشطة)
  const completedProviders = orderHistory
    .filter((o) => o.status === OrderStatus.COMPLETED && o.provider_id)
    .map((order) => {
      const provider = allProviders.find((p) => p.id === order.provider_id);
      return {
        order,
        provider,
      };
    })
    .filter((x) => x.provider !== undefined);

// [شرح الدالة: handleOpenChat] يفتح المحادثة مع مقدم الخدمة المختار.
  const handleOpenChat = (providerId: string) => {
    router.push({
      pathname: '/orders/chat',
      params: { provider_id: providerId },
    });
  };

// [شرح الدالة: handleRequestAgain] يبدأ طلب خدمة جديدًا اعتمادًا على المحادثة/الطلب السابق.
  const handleRequestAgain = (providerId: string) => {
    router.push({
      pathname: '/orders/request-again',
      params: { provider_id: providerId },
    });
  };

// [شرح الدالة: getStatusBadge] يحدد النص أو الشارة المناسبة لعرض حالة العنصر.
  const getStatusBadge = (status: ChatStatus) => {
    switch (status) {
      case ChatStatus.NEGOTIATING:
        return { text: t('orders.chat.statusNegotiating'), color: scheme.primary };
      case ChatStatus.AWAITING_APPROVAL:
        return { text: t('orders.chat.statusAwaitingApproval'), color: scheme.warning };
      case ChatStatus.ACTIVE:
        return { text: t('orders.chat.statusActive'), color: scheme.success };
      case ChatStatus.LOCKED_NOT_CHOSEN:
        return { text: t('orders.chat.statusLockedNotChosen'), color: scheme.textTertiary };
      case ChatStatus.LOCKED_COMPLETED:
        return { text: t('orders.chat.statusLockedCompleted'), color: scheme.textTertiary };
    }
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
          {t('tabs.messages')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {allThreads.length === 0 && completedProviders.length === 0 && incoming.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="chatbubbles-outline" size={64} color={scheme.textTertiary} />
          <Text style={[styles.emptyTitle, { color: scheme.text }]}>
            {t('messages.empty')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: scheme.textSecondary }]}>
            {t('messages.emptyHint')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...incoming.map((conv) => ({ type: 'incoming' as const, conv })),
            ...allThreads.map((item) => ({ type: 'active' as const, ...item })),
            ...completedProviders.map((item) => ({
              type: 'completed' as const,
              thread: null,
              ...item,
            })),
          ]}
          keyExtractor={(item, index) =>
            item.type === 'incoming'
              ? `incoming_${item.conv.conversation_id}`
              : item.type === 'active'
                ? item.thread!.id
                : `completed_${item.order!.id}_${index}`
          }
          renderItem={({ item }) => {
            if (item.type === 'incoming') {
              const { conv } = item;
              return (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/orders/conversation',
                      params: { conversation_id: conv.conversation_id, name: conv.other_name },
                    })
                  }
                >
                  <AppCard padding="three" elevation="sm" style={styles.card}>
                    <View style={styles.row}>
                      <Ionicons name="chatbubble-ellipses" size={28} color={scheme.primary} />
                      <View style={{ flex: 1, marginStart: Spacing.three }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                          <Text style={[{ flex: 1, color: scheme.text, fontWeight: FontWeights.bold, fontSize: FontSizes.base }]} numberOfLines={1}>
                            {conv.other_name}
                          </Text>
                          {conv.unread_count > 0 && (
                            <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: scheme.primary }}>
                              <Text style={{ color: scheme.primaryContrast, fontSize: FontSizes.xs, fontWeight: FontWeights.bold }}>
                                {conv.unread_count > 99 ? '99+' : conv.unread_count}
                              </Text>
                            </View>
                          )}
                        </View>
                        {!!conv.request_text && (
                          <Text style={{ color: scheme.textSecondary, fontSize: FontSizes.xs }} numberOfLines={1}>
                            {conv.request_text}
                          </Text>
                        )}
                        <Text style={{ color: scheme.textSecondary, fontSize: FontSizes.sm }} numberOfLines={1}>
                          {conv.last_message_body ?? 'لا توجد رسائل بعد'}
                        </Text>
                      </View>
                    </View>
                  </AppCard>
                </Pressable>
              );
            }
            if (item.type === 'active') {
              const { thread, provider } = item;
              if (!thread || !provider) return null;
              const badge = getStatusBadge(thread.status);
              const lastMsg = thread.last_message;

              return (
                <Pressable onPress={() => handleOpenChat(provider.id)}>
                  <AppCard padding="three" elevation="sm" style={styles.card}>
                    <View style={styles.row}>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: `${provider.card_color}30` },
                        ]}
                      >
                        <Text style={[styles.avatarText, { color: provider.card_color }]}>
                          {provider.name.charAt(0)}
                        </Text>
                      </View>
                      <View style={styles.info}>
                        <View style={styles.nameRow}>
                          <Text style={[styles.name, { color: scheme.text }]} numberOfLines={1}>
                            {provider.name}
                          </Text>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: `${badge.color}15` },
                            ]}
                          >
                            <Text style={[styles.statusText, { color: badge.color }]}>
                              {badge.text}
                            </Text>
                          </View>
                        </View>
                        {lastMsg && (
                          <Text
                            style={[styles.lastMsg, { color: scheme.textSecondary }]}
                            numberOfLines={1}
                          >
                            {lastMsg.is_system ? '📢 ' : ''}
                            {lastMsg.content}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name="chevron-back"
                        size={20}
                        color={scheme.textTertiary}
                      />
                    </View>
                  </AppCard>
                </Pressable>
              );
            }

            // completed
            const { order, provider } = item;
            if (!order || !provider) return null;

            return (
              <AppCard padding="three" elevation="sm" style={styles.card}>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: `${provider.card_color}30` },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: provider.card_color }]}>
                      {provider.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.info}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: scheme.text }]} numberOfLines={1}>
                        {provider.name}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: `${scheme.success}15` },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: scheme.success }]}>
                          {t('orders.myOrders.completedBadge')}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.lastMsg, { color: scheme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {order.description}
                    </Text>
                  </View>
                </View>

                <View style={styles.completedActions}>
                  <AppButton
                    title={t('orders.myOrders.actions.requestAgain')}
                    variant="primary"
                    size="sm"
                    onPress={() => handleRequestAgain(provider.id)}
                    fullWidth={false}
                    style={{ flex: 1 }}
                    leadingIcon={
                      <Ionicons name="refresh" size={14} color={scheme.primaryContrast} />
                    }
                  />
                  <AppButton
                    title={t('orders.myOrders.actions.viewDetails')}
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: '/orders/rate',
                        params: { order_id: order.id, readonly: 'true' },
                      })
                    }
                    fullWidth={false}
                    style={{ flex: 1, marginStart: Spacing.two }}
                  />
                </View>
              </AppCard>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
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
  },
  card: {
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
  },
  info: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
    gap: Spacing.two,
  },
  name: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  lastMsg: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
  },
  completedActions: {
    flexDirection: 'row',
    marginTop: Spacing.three,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    marginTop: Spacing.four,
    writingDirection: 'rtl',
  },
  emptySubtitle: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.two,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});