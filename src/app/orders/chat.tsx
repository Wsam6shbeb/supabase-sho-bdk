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
import { supabase } from '@/services/supabase';
import { ChatStatus } from '@/types/common';
import type { ChatMessage } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
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

  const provider = getProviderById(activeProviderId);
  const thread = getThreadByProviderId(activeProviderId);

  const currentMessages = useMemo(() => {
    if (!thread) return [];
    const local = messages[thread.id];
    if (local) return local;
    return thread.last_message ? [thread.last_message] : [];
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

// [شرح الدالة: handleSend] يرسل البيانات الحالية إلى العملية المرتبطة بالصفحة، مثل الرسالة أو رمز التحقق.
  const handleSend = (text: string) => {
    const newMessage: ChatMessage = {
      id: api.randomId('msg'),
      order_id: thread.order_id,
      sender_id: 'me',
      receiver_id: provider.id,
      content: text,
      is_system: false,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => ({
      ...prev,
      [thread.id]: [
        ...(prev[thread.id] ?? (thread.last_message ? [thread.last_message] : [])),
        newMessage,
      ],
    }));

    // مزامنة أفضل محاولة (best-effort) مع Supabase — لا تُغيّر الحالة المحلية
    // أعلاه ولا الواجهة. conversation_id هون هو معرّف المحادثة المحلي (thread.id)
    // وقد لا يقابل صفاً حقيقياً بجدول conversations بعد (نظام الطلبات/المحادثات
    // الحالي محلي بالكامل)، فمن المتوقع فشل الإدراج بهالحالة، وبيتم تسجيله فقط.
    (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          console.error('[Supabase][handleSend] تعذر جلب المستخدم الحالي:', authError.message);
          return;
        }
        const senderId = authData.user?.id;
        if (!senderId) {
          console.error('[Supabase][handleSend] لا يوجد مستخدم مسجّل دخول، تم تجاوز حفظ الرسالة.');
          return;
        }

        const { data, error } = await supabase
          .from('messages')
          .insert({
            conversation_id: thread.id,
            sender_id: senderId,
            body: text,
          })
          .select()
          .single();

        if (error) {
          console.error('[Supabase][handleSend] فشل حفظ الرسالة:', error.message, {
            conversation_id: thread.id,
          });
          return;
        }

        console.log('[Supabase][handleSend] تم حفظ الرسالة بنجاح:', data.id);
      } catch (err) {
        console.error('[Supabase][handleSend] خطأ غير متوقع أثناء حفظ الرسالة:', err);
      }
    })();
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