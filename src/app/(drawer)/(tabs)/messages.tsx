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
import {
  archiveConversation,
  fetchMyArchivedConversationIds,
  fetchMyConversations,
  subscribeToInbox,
  unarchiveConversation,
  type InboxConversation,
} from '@/services/chat';
import { isOffline, subscribeNetworkStatus } from '@/services/networkStatus';
import { ChatStatus, OrderStatus } from '@/types/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  const [archivedConversationIds, setArchivedConversationIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  // فشل تحميل صندوق الوارد: نميّزه عن القائمة الفارغة فعلاً
  const [inboxFailed, setInboxFailed] = useState(false);
  const [archiveFailed, setArchiveFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const loadInbox = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      // المحادثات أولاً وبشكل مستقل: انتظار الأرشيف أو تعليقه يجب ألا يُبقي القائمة فارغة.
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let rows: InboxConversation[] | null = null;
        try {
          rows = (await fetchMyConversations()) ?? null;
        } catch (error) {
          console.error('[messages] تعذّر جلب المحادثات:', error);
          rows = null;
        }
        if (!isMountedRef.current) return;

        if (rows !== null) {
          setInbox(rows);
          setInboxFailed(false);
          break;
        }

        if (isOffline() || attempt === maxAttempts) {
          setInboxFailed(true);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        if (!isMountedRef.current) return;
      }
    } finally {
      inFlightRef.current = false;
    }

    void (async () => {
      try {
        const archivedIds = (await fetchMyArchivedConversationIds()) ?? null;
        if (!isMountedRef.current) return;
        if (archivedIds !== null) {
          setArchivedConversationIds(archivedIds);
          setArchiveFailed(false);
        } else {
          setArchiveFailed(true);
        }
      } catch (error) {
        console.error('[messages] تعذّر جلب الأرشيف:', error);
        if (isMountedRef.current) setArchiveFailed(true);
      }
    })();
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

  // ربط سجل الطلب المكتمل بمعرّف المحادثة الحقيقي حتى تبقى الأرشفة شخصية.
  const conversationItems = [
    ...inboxThreads.map((conv) => ({
      type: 'incoming' as const,
      conv,
      conversationId: conv.conversation_id,
    })),
    ...allThreads.map((item) => ({
      type: 'active' as const,
      ...item,
      conversationId: item.thread.conversation_id ?? null,
    })),
    ...completedProviders.map((item) => ({
      type: 'completed' as const,
      thread: null,
      ...item,
      conversationId:
        inbox.find(
          (conv) =>
            conv.request_id === item.order.id &&
            conv.other_user_id === item.order.provider_id,
        )?.conversation_id ?? null,
    })),
  ];
  const archivedIdSet = new Set(archivedConversationIds);
  const archivedItems = conversationItems.filter(
    (item) => item.conversationId != null && archivedIdSet.has(item.conversationId),
  );
  const activeItems = conversationItems.filter(
    (item) => item.conversationId == null || !archivedIdSet.has(item.conversationId),
  );
  const visibleItems = showArchived ? archivedItems : activeItems;
  const hasConversations = visibleItems.length > 0;

  const handleArchiveToggle = async (conversationId: string) => {
    if (!allowPress()) return;
    const isArchived = archivedConversationIds.includes(conversationId);
    const result = isArchived
      ? await unarchiveConversation(conversationId)
      : await archiveConversation(conversationId);

    if (!result.ok) {
      Alert.alert(
        t('common.somethingWentWrong'),
        t(isArchived ? 'messages.unarchiveFailed' : 'messages.archiveFailed'),
      );
      return;
    }

    // انتقال سلس للقائمة عند نقل المحادثة بين الرسائل والأرشيف.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArchivedConversationIds((current) =>
      isArchived
        ? current.filter((id) => id !== conversationId)
        : current.includes(conversationId)
          ? current
          : [...current, conversationId],
    );
  };

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
          {t(showArchived ? 'messages.archiveTitle' : 'tabs.messages')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
          style={styles.list}
          removeClippedSubviews={false}
          extraData={`${showArchived}:${archivedConversationIds.join(',')}`}
          ListHeaderComponent={
            inboxFailed || (showArchived && archiveFailed) ? (
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
          data={visibleItems}
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
                <AppCard padding="three" elevation="sm" style={styles.card}>
                  <View style={styles.row}>
                    <Pressable
                      style={styles.conversationMain}
                      onPress={() => {
                        if (!allowPress()) return;
                        router.push({
                          pathname: '/orders/conversation',
                          params: { conversation_id: conv.conversation_id, name: conv.other_name },
                        });
                      }}
                    >
                      <Ionicons name="chatbubble-ellipses" size={28} color={scheme.primary} />
                      <View style={{ flex: 1, minWidth: 0, marginStart: Spacing.three }}>
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
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(showArchived ? 'messages.unarchive' : 'messages.archive')}
                      hitSlop={10}
                      style={styles.archiveAction}
                      onPress={() => void handleArchiveToggle(conv.conversation_id)}
                    >
                      <Ionicons
                        name={showArchived ? 'archive' : 'archive-outline'}
                        size={21}
                        color={scheme.textSecondary}
                      />
                      <Text style={[styles.archiveActionText, { color: scheme.textSecondary }]}>
                        {t(showArchived ? 'messages.unarchive' : 'messages.archive')}
                      </Text>
                    </Pressable>
                  </View>
                </AppCard>
              );
            }
            if (item.type === 'active') {
              const { thread, provider } = item;
              if (!thread || !provider) return null;
              const badge = getStatusBadge(thread.status);
              const lastMsg = thread.last_message;

              return (
                <AppCard padding="three" elevation="sm" style={styles.card}>
                  <View style={styles.row}>
                    <Pressable style={styles.conversationMain} onPress={() => handleOpenChat(provider.id)}>
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
                      <Ionicons name="chevron-back" size={20} color={scheme.textTertiary} />
                    </Pressable>
                    {item.conversationId && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t(showArchived ? 'messages.unarchive' : 'messages.archive')}
                        hitSlop={10}
                        style={styles.archiveAction}
                        onPress={() => void handleArchiveToggle(item.conversationId!)}
                      >
                        <Ionicons
                          name={showArchived ? 'archive' : 'archive-outline'}
                          size={21}
                          color={scheme.textSecondary}
                        />
                        <Text style={[styles.archiveActionText, { color: scheme.textSecondary }]}>
                          {t(showArchived ? 'messages.unarchive' : 'messages.archive')}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </AppCard>
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
                  {item.conversationId && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(showArchived ? 'messages.unarchive' : 'messages.archive')}
                      hitSlop={10}
                      style={styles.archiveAction}
                      onPress={() => void handleArchiveToggle(item.conversationId!)}
                    >
                      <Ionicons
                        name={showArchived ? 'archive' : 'archive-outline'}
                        size={21}
                        color={scheme.textSecondary}
                      />
                    </Pressable>
                  )}
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
              ? (inboxFailed || (showArchived && archiveFailed))
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
                        {t(showArchived ? 'messages.archiveEmpty' : 'messages.empty')}
                      </Text>
                      <Text style={[styles.emptySubtitle, { color: scheme.textSecondary }]}>
                        {t(showArchived ? 'messages.archiveEmptyHint' : 'messages.emptyHint')}
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
      <View style={[styles.archiveBar, { borderTopColor: scheme.border, backgroundColor: scheme.background }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(showArchived ? 'messages.backToMessages' : 'messages.archiveTitle')}
          style={styles.archiveFooter}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowArchived((current) => !current);
          }}
        >
          <Ionicons
            name={showArchived ? 'chatbubbles-outline' : 'archive-outline'}
            size={22}
            color={scheme.primary}
          />
          <Text style={[styles.archiveFooterText, { color: scheme.primary }]}>
            {t(showArchived ? 'messages.backToMessages' : 'messages.archiveTitle')}
          </Text>
          {!showArchived && (
            <Text style={[styles.archiveCount, { color: scheme.textSecondary }]}>
              {archivedItems.length}
            </Text>
          )}
          <Ionicons name="chevron-back" size={18} color={scheme.textTertiary} />
        </Pressable>
      </View>
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
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
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
    width: '100%',
  },
  conversationMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  archiveAction: {
    flexShrink: 0,
    minWidth: 72,
    height: 42,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radii.sm,
  },
  archiveActionText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  archiveBar: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  archiveFooter: {
    minHeight: 54,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  archiveFooterText: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  archiveCount: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
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
  info: { flex: 1, minWidth: 0 },
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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.eight,
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