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
import { allowPress } from '@/utils/single-press';
import { AppCard } from '@/components/ui/AppCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { fetchMyConversations, subscribeToInbox, type InboxConversation } from '@/services/chat';
import { isOffline, subscribeNetworkStatus } from '@/services/networkStatus';
import { ChatStatus, OrderStatus } from '@/types/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: MessagesTab] يعرض قائمة المحادثات والرسائل المرتبطة بطلبات المستخدم.
export default function MessagesTab() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const {
    activeChats,
    allProviders,
    orderHistory,
  } = useOrder();

  // كل محادثاتي من الخادم (كطالب خدمة أو كمقدم خدمة) مع تحديث لحظي
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  // فشل تحميل صندوق الوارد: نميّزه عن القائمة الفارغة فعلاً
  const [inboxFailed, setInboxFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const loadInbox = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      // محاولات محدودة عند فشل الجلب (بلا طلبات متكررة بلا توقف)
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const rows = await fetchMyConversations();
        if (!isMountedRef.current) return;
        // نجاح: نحدّث القائمة ونصفّر حالة الفشل (حتى لو كانت القائمة فارغة فعلاً)
        if (rows !== null) {
          setInbox(rows);
          setInboxFailed(false);
          return;
        }
        // فشل: أثناء انقطاع الشبكة لا فائدة من إعادة المحاولة فوراً،
        // ننتظر عودة الاتصال (انظر اشتراك subscribeNetworkStatus أدناه)
        if (isOffline() || attempt === maxAttempts) {
          setInboxFailed(true);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        if (!isMountedRef.current) return;
      }
      setInboxFailed(true);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const unsubscribeInbox = subscribeToInbox(() => void loadInbox());
    // إعادة الجلب تلقائياً عند عودة الاتصال دون الحاجة لإعادة تشغيل التطبيق
    const unsubscribeNetwork = subscribeNetworkStatus((offline) => {
      if (!offline) void loadInbox();
    });
    return () => {
      isMountedRef.current = false;
      unsubscribeInbox();
      unsubscribeNetwork();
    };
  }, [loadInbox]);

  // تحديث القائمة كلما عاد المستخدم إلى صفحة الرسائل.
  useFocusEffect(
    useCallback(() => {
      void loadInbox();
    }, [loadInbox]),
  );

  const handleRefresh = useCallback(async () => {
    if (inFlightRef.current) return;
    setRefreshing(true);
    try {
      await loadInbox();
    } finally {
      setRefreshing(false);
    }
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

  // محادثات الخادم التي نعرضها مباشرة (للطرفين)، بعد استثناء ما يظهر مسبقاً
  // في القائمة المحلية (نشطة بحسب معرّف المحادثة، أو مكتملة بحسب معرّف الطلب)
  const activeConversationIds = new Set(
    activeChats
      .map((thread) => thread.conversation_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  const completedRequestIds = new Set(
    orderHistory.filter((o) => o.status === OrderStatus.COMPLETED).map((o) => o.id),
  );
  const inboxThreads = inbox.filter(
    (conv) =>
      !activeConversationIds.has(conv.conversation_id) && !completedRequestIds.has(conv.request_id),
  );

  // هل لدينا أي محادثة لعرضها فعلاً؟ (نشطة أو مكتملة أو من الخادم)
  const hasConversations =
    allThreads.length > 0 || completedProviders.length > 0 || inbox.length > 0;

// [شرح الدالة: handleOpenChat] يفتح المحادثة مع مقدم الخدمة المختار.
  const handleOpenChat = (providerId: string) => {
    if (!allowPress()) return;
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
                {/* التعليق لزر رجوع يعيدنا الى صفحة البروفايل */}
        {/* <Pressable onPress={() => router.replace('/(drawer)/profile')} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={scheme.primary} />
        </Pressable> */}
        <Text style={[styles.title, { color: scheme.text }]}>
          {t('tabs.messages')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
          removeClippedSubviews={false}
          ListHeaderComponent={
            inboxFailed ? (
              <View style={styles.inboxNotice}>
                <Text style={[styles.inboxNoticeText, { color: scheme.textSecondary }]}>
                  {t('messages.refreshFailed')}
                </Text>
                <Pressable onPress={() => void loadInbox()} hitSlop={8}>
                  <Text style={[styles.inboxNoticeRetry, { color: scheme.primary }]}>
                    {t('common.retry')}
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          data={[
            ...inboxThreads.map((conv) => ({ type: 'incoming' as const, conv })),
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
                  onPress={() => {
                    if (!allowPress()) return;
                    router.push({
                      pathname: '/orders/conversation',
                      params: { conversation_id: conv.conversation_id, name: conv.other_name },
                    });
                  }}
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
          ListEmptyComponent={
            !hasConversations
              ? inboxFailed
                ? (
                    <ErrorState
                      title={t('messages.loadFailedTitle')}
                      message={t('messages.loadFailedHint')}
                      onRetry={() => void loadInbox()}
                    />
                  )
                : (
                    <View style={styles.emptyWrap}>
                      <Ionicons name="chatbubbles-outline" size={64} color={scheme.textTertiary} />
                      <Text style={[styles.emptyTitle, { color: scheme.text }]}>
                        {t('messages.empty')}
                      </Text>
                      <Text style={[styles.emptySubtitle, { color: scheme.textSecondary }]}>
                        {t('messages.emptyHint')}
                      </Text>
                    </View>
                  )
              : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
          }
          showsVerticalScrollIndicator={false}
        />
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
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  card: {
    marginBottom: Spacing.two,
  },
  inboxNotice: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  inboxNoticeText: {
    flexShrink: 1,
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inboxNoticeRetry: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    textDecorationLine: 'underline',
    writingDirection: 'rtl',
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