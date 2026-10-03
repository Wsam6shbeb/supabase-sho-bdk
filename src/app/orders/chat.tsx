// ===============================================================
// شرح الملف: هذا صفحة المحادثة بين العميل ومقدم الخدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ChatScreen، handleSend، handleCustomerAgree، confirmCustomerAgreement، handleProviderApprove، handleProviderReject، handleCompleteOrder، handleCloseNegotiation، handleSwitchProvider.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة المحادثة مع مقدم الخدمة
// ═══════════════════════════════════════════════════════════

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
import { openConversation } from '@/services/chat';
import { useConversation } from '@/hooks/use-conversation';
import { ChatStatus } from '@/types/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
    allProviders,
    currentOrder,
    activeChats,
    getThreadByProviderId,
    getProviderById,
    openChat,
    customerAgrees,
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

  // 🧪 زر تجربة مؤقت — يخليك تشوف الشاشة كأنك مقدم الخدمة عشان تجرب موافقة/رفض
  // الاتفاق (ما في حساب مقدم خدمة حقيقي بعد). يُحذف لما يصير في حساب مقدم خدمة حقيقي.

  // معرّف المحادثة الحقيقي إذا لم يصل بعد من الـ Context (مثلاً تأخر الشبكة)
  const [fallbackConversationIds, setFallbackConversationIds] = useState<Record<string, string>>({});

  const provider = getProviderById(activeProviderId);
  const thread = getThreadByProviderId(activeProviderId);

  const conversationId = thread
    ? (thread.conversation_id ?? fallbackConversationIds[thread.id] ?? null)
    : null;
  const myId = user?.id ?? null;

  // إذا لم تُفتح المحادثة بعد في قاعدة البيانات نفتحها عند أول إرسال
  const ensureConversationId = useCallback(async () => {
    if (!thread || !provider) return null;
    const opened = await openConversation(currentOrder?.id ?? thread.order_id, provider.id);
    if (opened.id) {
      setFallbackConversationIds((prev) => ({ ...prev, [thread.id]: opened.id as string }));
    }
    return opened.id;
  }, [thread, provider, currentOrder?.id]);

  // كل منطق الريال تايم/الإرسال/حالات الرسائل في الـ Hook الموحّد
  const {
    messages: remoteMessages,
    send: sendChatMessage,
    retry: retryMessage,
    partnerTyping,
    notifyTyping,
  } = useConversation({ conversationId, myId, ensureConversationId });

  // الرسالة الترحيبية وفقاعة الاتفاق تأتيان من حالة التطبيق (وليستا من السيرفر)
  const currentMessages = useMemo(() => {
    if (!thread) return [];
    // نضيف فقط الرسائل التي لا تأتي من السيرفر (الترحيب/النظام وفقاعة الاتفاق)
    const extra = thread.last_message;
    const isLocalOnly = !!extra && (extra.is_system || extra.id.startsWith('agreement_'));
    const list = extra && isLocalOnly && !remoteMessages.some((m) => m.id === extra.id)
      ? [...remoteMessages, extra]
      : remoteMessages;
    return [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [remoteMessages, thread]);

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

// [شرح الدالة: handleSend] يرسل الرسالة عبر Supabase (التفاصيل داخل useConversation).
  const handleSend = (text: string) => {
    void sendChatMessage(text);
  };

// [شرح الدالة: handleCustomerAgree] يعالج موافقة العميل على الاتفاق داخل المحادثة.
  const handleCustomerAgree = () => setShowCustomerConfirm(true);

// [شرح الدالة: confirmCustomerAgreement] يؤكد موافقة العميل بعد إتمام خطوة التأكيد المطلوبة.
  const confirmCustomerAgreement = async () => {
    const result = await customerAgrees(
      thread.id,
      provider.id,
      user?.name ?? 'الزبون',
      currentMessages,
    );
    if (!result.ok) {
      Alert.alert('', result.error ?? 'تعذر إرسال طلب الاتفاق. حاول مرة أخرى.');
      return;
    }
    setShowCustomerConfirm(false);
    setSharePhone(false);
  };

// [شرح الدالة: handleCompleteOrder] ينفذ خطوة إكمال الطلب بعد انتهاء الخدمة.
  const handleCompleteOrder = async () => {
    const orderId = thread.order_id;
    const result = await completeOrder();
    if (!result.ok) {
      Alert.alert('', result.error ?? 'تعذر إنهاء الخدمة. حاول مرة أخرى.');
      return;
    }
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

  const canCustomerAgree = thread.status === ChatStatus.NEGOTIATING;
  const canCustomerCancel = thread.status === ChatStatus.AWAITING_APPROVAL;
  const canCustomerComplete = thread.status === ChatStatus.ACTIVE;
  const canSendMessage =
    thread.status === ChatStatus.NEGOTIATING || thread.status === ChatStatus.ACTIVE;
  const isLocked = thread.status === ChatStatus.LOCKED_NOT_CHOSEN;
  const isActive = thread.status === ChatStatus.ACTIVE;

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

        <ProviderSwitcher
          threads={activeChats}
          providers={allProviders}
          activeProviderId={activeProviderId}
          onSelect={handleSwitchProvider}
        />

        <FlatList
          data={currentMessages}
          renderItem={({ item }) => {
            return (
              <ChatBubble
                message={item}
                isMine={item.sender_id === 'me'}
                onRetry={retryMessage}
              />
            );
          }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {partnerTyping && (
          <Text style={[styles.typingText, { color: scheme.textSecondary }]}>
            يكتب الآن...
          </Text>
        )}

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

        {canCustomerAgree && !showCustomerConfirm && (
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
            onChangeText={notifyTyping}
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
  typingText: {
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
  },
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