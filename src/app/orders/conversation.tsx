// ===============================================================
// شاشة محادثة عامة مبنية بالكامل على Supabase (تعمل للطرفين: طالب الخدمة ومقدم الخدمة).
// تُفتح بمعرّف المحادثة الحقيقي: /orders/conversation?conversation_id=...&name=...
// ===============================================================

import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { AgreementBubble } from '@/components/orders/AgreementBubble';
import { AppButton } from '@/components/ui/AppButton';
import { ChatBlockedNotice } from '@/components/orders/ChatBlockedNotice';
import { ChatBubble } from '@/components/orders/ChatBubble';
import { ChatInput } from '@/components/orders/ChatInput';
import { BottomInsetSpacer } from '@/components/ui/BottomInsetSpacer';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useConversation } from '@/hooks/use-conversation';
import {
  getConversationRatingStatus,
  orderErrorMessage,
  submitRating,
  type ConversationRatingStatus,
} from '@/services/orders';
import {
  agreementErrorMessage,
  getConversationAgreement,
  respondToAgreement,
  subscribeToAgreementChanges,
  type DbAgreement,
} from '@/services/agreements';
import type { ChatMessage } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConversationScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { isProviderBlocked, unblockProvider, refreshOrderHistory } = useOrder();

  const conversationId = typeof params.conversation_id === 'string' ? params.conversation_id : '';
  const otherName = typeof params.name === 'string' && params.name ? params.name : 'محادثة';
  const myId = user?.id ?? null;

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [sharePhone, setSharePhone] = useState(false);

  const { messages, send, retry, partnerTyping, notifyTyping, loadFailed, writeStatus, refreshWriteStatus } = useConversation({
    conversationId: conversationId || null,
    myId,
  });

  // ---------- الحظر / إغلاق المحادثة: لا حقل كتابة، بل شرح مناسب ----------
  const otherUserId = writeStatus?.other_user_id ?? null;
  const blockReason: 'blocked_by_me' | 'unavailable' | 'closed' | null =
    otherUserId && isProviderBlocked(otherUserId)
      ? 'blocked_by_me'
      : writeStatus?.reason === 'unavailable' || writeStatus?.reason === 'closed'
        ? writeStatus.reason
        : null;

  const handleUnblock = async () => {
    if (!otherUserId) return;
    await unblockProvider(otherUserId);
    await refreshWriteStatus();
  };

  // ---------- الاتفاق: مقدم الخدمة يوافق/يرفض من هنا (كله عبر Supabase) ----------
  const [agreement, setAgreement] = useState<DbAgreement | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const loadAgreement = useCallback(async () => {
    if (!conversationId) return;
    const result = await getConversationAgreement(conversationId);
    if (result !== undefined) setAgreement(result);
  }, [conversationId]);

  // ---------- تقييم الزبون (مقدم الخدمة يقيّم بعد إنهاء الخدمة) ----------
  const [ratingStatus, setRatingStatus] = useState<ConversationRatingStatus | null>(null);
  const [stars, setStars] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);

  const loadRatingStatus = useCallback(async () => {
    if (!conversationId) return;
    setRatingStatus(await getConversationRatingStatus(conversationId));
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !myId) return;
    // الاشتراك يستدعي المزامنة عند أول اتصال وعند كل تغيّر/إعادة اتصال
    return subscribeToAgreementChanges(
      () => {
        void loadAgreement();
        void loadRatingStatus();
      },
      { conversationId },
    );
  }, [conversationId, myId, loadAgreement, loadRatingStatus]);

  // رسالة نظام جديدة (إنهاء الخدمة / تقييم الطرفين) = تغيّرت حالة الطلب: نحدّث حالة التقييم والسجل.
  const lastSystemMessageId = [...messages].reverse().find((m) => m.is_system)?.id ?? null;
  useEffect(() => {
    if (!lastSystemMessageId) return;
    void loadRatingStatus();
    void refreshOrderHistory();
  }, [lastSystemMessageId, loadRatingStatus, refreshOrderHistory]);

  const orderFinished =
    ratingStatus?.request_state === 'completion_pending_rating' ||
    ratingStatus?.request_state === 'completed' ||
    Boolean(ratingStatus?.has_non_execution_report && ratingStatus?.request_state === 'cancelled');
  const iAmProvider = agreement?.provider_id === myId;
  const canRateCustomer = !!ratingStatus && orderFinished && !ratingStatus.i_rated && iAmProvider;

  const handleRateCustomer = async () => {
    if (!ratingStatus || stars < 1) return;
    setRatingBusy(true);
    const result = await submitRating({ requestId: ratingStatus.request_id, score: stars });
    setRatingBusy(false);
    if (!result.ok && !(result.error ?? '').includes('ALREADY_RATED')) {
      Alert.alert('', orderErrorMessage(result.error));
      return;
    }
    setStars(0);
    void loadRatingStatus();
    void refreshOrderHistory();
  };

  const pendingForMe =
    agreement?.state === 'pending' && agreement.provider_id === myId ? agreement : null;

  // العدّ التنازلي لمهلة الموافقة؛ عند انتهائها نسأل السيرفر لينهي الاتفاق
  useEffect(() => {
    if (!pendingForMe) {
      setRemainingSeconds(0);
      return;
    }
    const expiresAt = new Date(pendingForMe.expires_at).getTime();
    let expiryChecked = false;
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0 && !expiryChecked) {
        expiryChecked = true; // مرة واحدة فقط: السيرفر ينهي الاتفاق ويصلنا التغيير
        void loadAgreement();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pendingForMe?.id, pendingForMe?.expires_at, loadAgreement]);

  const respond = async (approve: boolean): Promise<boolean> => {
    if (!pendingForMe) return false;
    const { agreement: updated, error } = await respondToAgreement({
      agreementId: pendingForMe.id,
      approve,
      sharePhone: approve ? sharePhone : false,
      reason: approve ? undefined : 'rejected_by_provider',
    });
    if (error || !updated) {
      Alert.alert('', agreementErrorMessage(error));
      void loadAgreement();
      return false;
    }
    setAgreement(updated);
    if (updated.state === 'expired') {
      Alert.alert('', 'انتهت مهلة الموافقة على هالاتفاق.');
    }
    return true;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: scheme.backgroundElevated, borderBottomColor: scheme.border },
          ]}
        >
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="arrow-forward" size={24} color={scheme.primary} />
          </Pressable>
          <Text style={[styles.title, { color: scheme.text }]} numberOfLines={1}>
            {otherName}
          </Text>
          <View style={styles.backBtn} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble message={item} isMine={item.sender_id === 'me'} onRetry={retry} />
          )}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            canRateCustomer ? (
              <View style={[styles.ratingCard, { backgroundColor: scheme.backgroundElevated, borderColor: scheme.border }]}>
                <Text style={[styles.ratingTitle, { color: scheme.text }]}>كيف كانت تجربتك مع {otherName}؟</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
                      <Ionicons
                        name={n <= stars ? 'star' : 'star-outline'}
                        size={34}
                        color={n <= stars ? scheme.warning : scheme.textSecondary}
                      />
                    </Pressable>
                  ))}
                </View>
                <AppButton
                  title="إرسال التقييم"
                  variant="primary"
                  size="md"
                  onPress={() => void handleRateCustomer()}
                  disabled={stars < 1 || ratingBusy}
                  loading={ratingBusy}
                />
              </View>
            ) : ratingStatus?.both_rated && orderFinished ? (
              <Text style={[styles.statusText, { color: scheme.textSecondary }]}>
                اكتملت الخدمة وتم تقييم الطرفين.
              </Text>
            ) : ratingStatus?.i_rated && orderFinished ? (
              <Text style={[styles.statusText, { color: scheme.textSecondary }]}>
                {iAmProvider ? 'قيّمت الزبون' : 'قيّمت مقدم الخدمة'} بـ {ratingStatus.my_score} من 5 نجوم.
              </Text>
            ) : pendingForMe ? (
              <AgreementBubble
                customerName={otherName}
                agreedPrice={pendingForMe.price != null ? Number(pendingForMe.price) : null}
                commissionAmount={Number(pendingForMe.commission_amount)}
                remainingSeconds={remainingSeconds}
                onApprove={() => respond(true)}
                onReject={() => respond(false)}
                onSharePhoneChange={setSharePhone}
              />
            ) : null
          }
        />

        {loadFailed && (
          <Text style={[styles.statusText, { color: scheme.danger }]}>
            تعذر تحميل الرسائل. تحقق من الاتصال.
          </Text>
        )}
        {partnerTyping && (
          <Text style={[styles.statusText, { color: scheme.textSecondary }]}>يكتب الآن...</Text>
        )}

        {blockReason ? (
          <ChatBlockedNotice
            reason={blockReason}
            onUnblock={blockReason === 'blocked_by_me' ? handleUnblock : undefined}
          />
        ) : (
          <ChatInput onSend={(text) => void send(text)} onChangeText={notifyTyping} />
        )}

        {/* مساحة لأزرار النظام السفلية حتى لا يختفي حقل الكتابة خلفها */}
        <BottomInsetSpacer color={scheme.backgroundElevated} />
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
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  content: { padding: Spacing.three, gap: Spacing.two },
  ratingCard: {
    borderWidth: 1,
    borderRadius: Radii.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    marginTop: Spacing.three,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  starsRow: { flexDirection: 'row', gap: Spacing.two },
  statusText: {
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
  },
});
