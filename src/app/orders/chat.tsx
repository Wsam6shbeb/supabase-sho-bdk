// ===============================================================
// شرح الملف: هذا صفحة المحادثة بين العميل ومقدم الخدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ChatScreen، handleSend، handleCustomerAgree، confirmCustomerAgreement، handleProviderApprove، handleProviderReject، handleCompleteOrder، handleCloseNegotiation، handleSwitchProvider.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة المحادثة مع مقدم الخدمة
// ═══════════════════════════════════════════════════════════

import { AgreementBubble } from '@/components/orders/AgreementBubble';
import { ChatBubble } from '@/components/orders/ChatBubble';
import { ChatInput } from '@/components/orders/ChatInput';
import { ChatStatusBar } from '@/components/orders/ChatStatusBar';
import { ProviderSwitcher } from '@/components/orders/ProviderSwitcher';
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { api } from '@/services/api';
import {
  fetchMessages,
  openConversation,
  sendMessage,
  subscribeToMessages,
  type DbMessage,
} from '@/services/chat';
import { ChatStatus } from '@/types/common';
import type { ChatMessage } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: ChatScreen] يدير واجهة المحادثة وسير الاتفاق والتنفيذ المرتبط بالطلب.
export default function ChatScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const {
    candidates,
    currentOrder,
    activeChats,
    getThreadByProviderId,
    getProviderById,
    openChat,
    customerAgrees,
    providerApproves,
    providerRejects,
    customerCancelsAgreement,
    approvalRemainingSeconds,
    estimateCommission,
    completeOrder,
    closeChat,
  } = useOrder();

  const initialProviderId = params.provider_id as string;
  const [activeProviderId, setActiveProviderId] = useState(initialProviderId);
  const [showCustomerConfirm, setShowCustomerConfirm] = useState(false);
  const [sharePhone, setSharePhone] = useState(false);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});

  // 🧪 زر تجربة مؤقت — يخليك تشوف الشاشة كأنك مقدم الخدمة عشان تجرب موافقة/رفض
  // الاتفاق (ما في حساب مقدم خدمة حقيقي بعد). يُحذف لما يصير في حساب مقدم خدمة حقيقي.
  const [viewAsProvider, setViewAsProvider] = useState(false);

  // معرّف المحادثة الحقيقي إذا لم يصل بعد من الـ Context (مثلاً تأخر الشبكة)
  const [fallbackConversationIds, setFallbackConversationIds] = useState<Record<string, string>>({});

  const provider = getProviderById(activeProviderId);
  const thread = getThreadByProviderId(activeProviderId);

  const conversationId = thread
    ? (thread.conversation_id ?? fallbackConversationIds[thread.id] ?? null)
    : null;
  const myId = user?.id ?? null;

  // تحويل رسالة قاعدة البيانات إلى الشكل الذي تعرضه الواجهة
  const mapDbMessage = (m: DbMessage): ChatMessage => ({
    id: m.id,
    order_id: thread?.order_id ?? '',
    sender_id: m.message_type === 'system' ? 'system' : m.sender_id === myId ? 'me' : m.sender_id,
    receiver_id: m.sender_id === myId ? (provider?.id ?? '') : (myId ?? ''),
    content: m.body,
    is_system: m.message_type === 'system',
    created_at: m.created_at,
    read_at: null,
  });

  // دمج رسائل قادمة من Supabase مع الحالية: يستبدل الرسالة المؤقتة (التفاؤلية) بالحقيقية
  const mergeRemote = (threadId: string, incoming: DbMessage[], base: ChatMessage[]) => {
    setMessages((prev) => {
      const byId = new Map((prev[threadId] ?? base).map((m) => [m.id, m]));
      for (const m of incoming) {
        if (m.client_dedupe_key) byId.delete(m.client_dedupe_key);
        byId.set(m.id, mapDbMessage(m));
      }
      const merged = Array.from(byId.values()).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      return { ...prev, [threadId]: merged };
    });
  };

  // تحميل السجل + اشتراك لحظي بالرسائل الجديدة
  useEffect(() => {
    if (!thread || !conversationId || !myId) return;
    const threadId = thread.id;
    const base = thread.last_message ? [thread.last_message] : [];
    let cancelled = false;

    void fetchMessages(conversationId).then((rows) => {
      if (!cancelled && rows.length) mergeRemote(threadId, rows, base);
    });

    const unsubscribe = subscribeToMessages(conversationId, (row) => {
      if (!cancelled) mergeRemote(threadId, [row], base);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, myId, thread?.id]);

  const currentMessages = useMemo(() => {
    if (!thread) return [];
    const local = messages[thread.id];
    const base = local ?? (thread.last_message ? [thread.last_message] : []);
    // فقاعة الاتفاق تأتي من حالة الـ Context وليست من السيرفر، فنبقيها ظاهرة
    const agreement = thread.last_message;
    if (local && agreement && agreement.id.startsWith('agreement_') && !local.some((m) => m.id === agreement.id)) {
      return [...local, agreement];
    }
    return base;
  }, [messages, thread]);

  if (!provider || !thread) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle" size={64} color={scheme.danger} />
          <Text style={[styles.errorText, { color: scheme.text }]}>
            المحادثة غير موجودة
          </Text>
          <AppButton
            title={t('common.back')}
            variant="primary"
            size="md"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

// [شرح الدالة: handleSend] يرسل الرسالة عبر Supabase مع عرضها فوراً (تفاؤلياً) ثم تثبيتها عند وصول الرد.
  const handleSend = async (text: string) => {
    const clientKey = api.randomId('msg');
    const threadId = thread.id;
    const base = thread.last_message ? [thread.last_message] : [];

    const optimistic: ChatMessage = {
      id: clientKey,
      order_id: thread.order_id,
      sender_id: 'me',
      receiver_id: provider.id,
      content: text,
      is_system: false,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => ({ ...prev, [threadId]: [...(prev[threadId] ?? base), optimistic] }));

    const removeOptimistic = () =>
      setMessages((prev) => ({
        ...prev,
        [threadId]: (prev[threadId] ?? base).filter((m) => m.id !== clientKey),
      }));

    // إذا لم تُفتح المحادثة بعد في قاعدة البيانات نفتحها الآن
    let convId = conversationId;
    if (!convId) {
      const opened = await openConversation(currentOrder?.id ?? thread.order_id, provider.id);
      if (opened.id) {
        convId = opened.id;
        setFallbackConversationIds((prev) => ({ ...prev, [threadId]: opened.id as string }));
      }
    }

    if (!convId || !myId) {
      removeOptimistic();
      Alert.alert('', 'تعذر إرسال الرسالة. تحقق من الاتصال وحاول مرة أخرى.');
      return;
    }

    const { message, error } = await sendMessage({
      conversationId: convId,
      senderId: myId,
      body: text,
      clientKey,
    });

    if (error && error !== 'DUPLICATE') {
      console.error('[chat] فشل إرسال الرسالة:', error);
      removeOptimistic();
      Alert.alert('', 'تعذر إرسال الرسالة. حاول مرة أخرى.');
      return;
    }

    if (message) mergeRemote(threadId, [message], base);
  };

// [شرح الدالة: handleCustomerAgree] يعالج موافقة العميل على الاتفاق داخل المحادثة.
  const handleCustomerAgree = () => setShowCustomerConfirm(true);

// [شرح الدالة: confirmCustomerAgreement] يؤكد موافقة العميل بعد إتمام خطوة التأكيد المطلوبة.
  const confirmCustomerAgreement = () => {
    customerAgrees(thread.id, provider.id, user?.name ?? 'الزبون', currentMessages);
    setShowCustomerConfirm(false);
    setSharePhone(false);
  };

// [شرح الدالة: handleProviderApprove] يعالج موافقة مقدم الخدمة على الاتفاق.
  const handleProviderApprove = () => {
    providerApproves(thread.id);
    setViewAsProvider(false);
  };
// [شرح الدالة: handleProviderReject] يعالج رفض مقدم الخدمة للاتفاق.
  const handleProviderReject = () => {
    providerRejects(thread.id);
    setViewAsProvider(false);
  };

// [شرح الدالة: handleCompleteOrder] ينفذ خطوة إكمال الطلب بعد انتهاء الخدمة.
  const handleCompleteOrder = () => {
    const orderId = thread.order_id;
    completeOrder();
    router.replace({
      pathname: '/orders/rate',
      params: { order_id: orderId },
    });
  };

// [شرح الدالة: handleCloseNegotiation] يغلق مسار التفاوض/المحادثة وفق قواعد الطلب.
  const handleCloseNegotiation = () => {
    closeChat(thread.id);
    router.back();
  };

// [شرح الدالة: handleSwitchProvider] ينفذ تبديل مقدم الخدمة في الطلب.
  const handleSwitchProvider = (providerId: string) => {
    const existing = getThreadByProviderId(providerId);
    if (!existing) {
      const p = getProviderById(providerId);
      if (p) openChat(p);
    }
    setActiveProviderId(providerId);
  };

  const canCustomerAgree =
    !viewAsProvider && thread.status === ChatStatus.NEGOTIATING;
  const canCustomerCancel =
    !viewAsProvider && thread.status === ChatStatus.AWAITING_APPROVAL;
  const canProviderDecide =
    viewAsProvider && thread.status === ChatStatus.AWAITING_APPROVAL;
  const canCustomerComplete = !viewAsProvider && thread.status === ChatStatus.ACTIVE;
  const canSendMessage = !viewAsProvider && (
    thread.status === ChatStatus.NEGOTIATING || thread.status === ChatStatus.ACTIVE
  );
  const isLocked = thread.status === ChatStatus.LOCKED_NOT_CHOSEN;
  const isActive = thread.status === ChatStatus.ACTIVE;

  const isAgreementBubble = currentMessages.some(
    (m) => m.id === `agreement_${thread.id}`,
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: scheme.backgroundElevated,
              borderBottomColor: scheme.border,
            },
          ]}
        >
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="arrow-forward" size={24} color={scheme.primary} />
          </Pressable>

          <Pressable
            style={styles.headerCenter}
            onPress={() =>
              router.push({
                pathname: '/orders/provider-profile',
                params: { provider_id: provider.id, from: 'chat' },
              })
            }
          >
            <View
              style={[styles.headerAvatar, { backgroundColor: `${provider.card_color}30` }]}
            >
              <Text style={[styles.headerAvatarText, { color: provider.card_color }]}>
                {provider.name.charAt(0)}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.headerName, { color: scheme.text }]} numberOfLines={1}>
                {provider.name}
              </Text>
              <Text style={[styles.headerHint, { color: scheme.textSecondary }]}>
                {t('orders.chat.profileHint')}
              </Text>
            </View>
          </Pressable>

          {thread.status === ChatStatus.NEGOTIATING && (
            <Pressable
              onPress={handleCloseNegotiation}
              hitSlop={8}
              style={styles.closeChatBtn}
              accessibilityLabel="إنهاء المحادثة"
            >
              <Ionicons name="close-circle-outline" size={24} color={scheme.danger} />
            </Pressable>
          )}
        </View>

        <ChatStatusBar status={thread.status} />

        {/* 🧪 زر تجربة مؤقت — يُحذف لما يصير في حساب مقدم خدمة حقيقي */}
        {__DEV__ && thread.status === ChatStatus.AWAITING_APPROVAL && (
          <Pressable
            onPress={() => setViewAsProvider((v) => !v)}
            style={[
              styles.devToggle,
              { backgroundColor: viewAsProvider ? scheme.urgent : `${scheme.textTertiary}20` },
            ]}
          >
            <Ionicons
              name="flask"
              size={14}
              color={viewAsProvider ? scheme.urgentContrast : scheme.textSecondary}
            />
            <Text
              style={[
                styles.devToggleText,
                { color: viewAsProvider ? scheme.urgentContrast : scheme.textSecondary },
              ]}
            >
              {viewAsProvider
                ? t('orders.chat.devToggleOn')
                : t('orders.chat.devToggleOff')}
            </Text>
          </Pressable>
        )}

        <ProviderSwitcher
          threads={activeChats}
          providers={candidates}
          activeProviderId={activeProviderId}
          onSelect={handleSwitchProvider}
        />

        <FlatList
          data={currentMessages}
          renderItem={({ item }) => {
            if (item.id === `agreement_${thread.id}` && canProviderDecide) {
              return (
                <AgreementBubble
                  customerName={user?.name ?? 'الزبون'}
                  agreedPrice={currentOrder?.agreed_price ?? null}
                  commissionAmount={currentOrder?.commission_amount ?? estimateCommission(currentMessages)}
                  remainingSeconds={approvalRemainingSeconds}
                  onApprove={handleProviderApprove}
                  onReject={handleProviderReject}
                  onSharePhoneChange={setSharePhone}
                />
              );
            }
            return <ChatBubble message={item} isMine={item.sender_id === 'me'} />;
          }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {canCustomerCancel && (
          <View
            style={[
              styles.waitingNotice,
              {
                backgroundColor: `${scheme.warning}15`,
                borderColor: `${scheme.warning}40`,
              },
            ]}
          >
            <Ionicons name="time" size={18} color={scheme.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.waitingTitle, { color: scheme.warning }]}>
                {t('orders.chat.waitingTitle')}
              </Text>
              <Text style={[styles.waitingBody, { color: scheme.textSecondary }]}>
                {t('orders.chat.waitingSeconds', { seconds: approvalRemainingSeconds })}
              </Text>
            </View>
          </View>
        )}

        {isLocked && (
          <View
            style={[
              styles.lockedNotice,
              { backgroundColor: `${scheme.textTertiary}15` },
            ]}
          >
            <Ionicons name="lock-closed" size={16} color={scheme.textTertiary} />
            <Text style={[styles.lockedText, { color: scheme.textSecondary }]}>
              {t('orders.chat.lockedMessage')}
            </Text>
          </View>
        )}

        {isActive && (
          <View
            style={[styles.activeNotice, { backgroundColor: `${scheme.success}15` }]}
          >
            <Ionicons name="checkmark-circle" size={18} color={scheme.success} />
            <Text style={[styles.activeText, { color: scheme.success }]}>
              المحادثة نشطة — تم قبول الاتفاق
            </Text>
          </View>
        )}

        {canCustomerAgree && !showCustomerConfirm && !isAgreementBubble && (
          <View style={styles.actionWrap}>
            <AppButton
              title={t('orders.chat.agreeBtn')}
              variant="primary"
              size="lg"
              onPress={handleCustomerAgree}
              leadingIcon={
                <Ionicons
                  name="checkmark-done-circle"
                  size={20}
                  color={scheme.primaryContrast}
                />
              }
            />
          </View>
        )}

        {canCustomerCancel && (
          <View style={styles.actionWrap}>
            <AppButton
              title={t('orders.chat.cancelOrderBtn')}
              variant="danger"
              size="lg"
              onPress={customerCancelsAgreement}
              leadingIcon={
                <Ionicons name="close-circle" size={20} color={scheme.dangerContrast} />
              }
            />
          </View>
        )}

        {canCustomerComplete && (
          <View style={styles.actionWrap}>
            <AppButton
              title="تم إكمال الخدمة"
              variant="primary"
              size="lg"
              onPress={handleCompleteOrder}
              leadingIcon={
                <Ionicons
                  name="checkmark-done-circle"
                  size={20}
                  color={scheme.primaryContrast}
                />
              }
            />
          </View>
        )}

        {showCustomerConfirm && (
          <View
            style={[
              styles.confirmCard,
              {
                backgroundColor: scheme.backgroundElevated,
                borderColor: scheme.border,
              },
            ]}
          >
            <Text style={[styles.confirmTitle, { color: scheme.text }]}>
              {t('orders.chat.customerConfirmTitle')}
            </Text>
            <Text style={[styles.confirmBody, { color: scheme.textSecondary }]}>
              سيتم إرسال طلب تأكيد الاتفاق إلى {provider.name}. تأكد أن السعر والتفاصيل المتفق عليها واضحة في المحادثة قبل المتابعة.
            </Text>
            <View style={[styles.confirmPriceRow, { backgroundColor: `${scheme.primary}10`, borderColor: `${scheme.primary}30` }]}>
              <Text style={[styles.confirmPriceLabel, { color: scheme.textSecondary }]}>قيمة الخدمة المتفق عليها</Text>
              <Text style={[styles.confirmPriceValue, { color: scheme.text }]}>{currentOrder?.agreed_price != null ? `${currentOrder.agreed_price} ل.س` : 'غير محددة — يجب تأكيد السعر في المحادثة'}</Text>
            </View>

            <Pressable
              onPress={() => setSharePhone(!sharePhone)}
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: sharePhone ? scheme.primary : scheme.border,
                    backgroundColor: sharePhone ? scheme.primary : 'transparent',
                  },
                ]}
              >
                {sharePhone && (
                  <Ionicons name="checkmark" size={14} color={scheme.primaryContrast} />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: scheme.text }]}>
                {t('orders.chat.sharePhoneLabel')}
              </Text>
            </Pressable>

            <View style={styles.confirmActions}>
              <AppButton
                title={t('orders.chat.confirmBtn')}
                variant="primary"
                size="md"
                onPress={confirmCustomerAgreement}
                fullWidth={false}
                style={{ flex: 1 }}
              />
              <AppButton
                title={t('common.cancel')}
                variant="secondary"
                size="md"
                onPress={() => setShowCustomerConfirm(false)}
                fullWidth={false}
                style={{ flex: 1, marginStart: Spacing.two }}
              />
            </View>
          </View>
        )}

        {!showCustomerConfirm && (
          <ChatInput
            onSend={handleSend}
            disabled={!canSendMessage}
            placeholder={
              canSendMessage
                ? t('orders.chat.inputPlaceholder')
                : t('orders.chat.inputDisabled')
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderBottomWidth: 1,
  },
  backBtn: { padding: Spacing.two },
  closeChatBtn: {
    paddingStart: Spacing.two,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  headerInfo: { flex: 1 },
  headerName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  headerHint: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginTop: 2,
  },
  devToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radii.full,
    marginTop: Spacing.two,
  },
  devToggleText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  messagesContent: {
    paddingVertical: Spacing.four,
    flexGrow: 1,
  },
  waitingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  waitingTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  waitingBody: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginTop: 2,
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    borderRadius: Radii.md,
  },
  lockedText: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    flex: 1,
  },
  activeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    borderRadius: Radii.md,
  },
  activeText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
    flex: 1,
  },
  actionWrap: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  confirmCard: {
    margin: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  confirmTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  confirmBody: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.base + 4,
    writingDirection: 'rtl',
    textAlign: 'right',
    marginBottom: Spacing.three,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Radii.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    flex: 1,
  },
  confirmPriceRow: {
    padding: Spacing.three,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginBottom: Spacing.three,
    gap: Spacing.one,
  },
  confirmPriceLabel: { fontSize: FontSizes.sm, writingDirection: 'rtl', textAlign: 'right' },
  confirmPriceValue: { fontSize: FontSizes.base, fontWeight: FontWeights.bold, writingDirection: 'rtl', textAlign: 'right' },
  confirmActions: { flexDirection: 'row' },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.six,
  },
  errorText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
});