// ===============================================================
// شاشة محادثة عامة مبنية بالكامل على Supabase (تعمل للطرفين: طالب الخدمة ومقدم الخدمة).
// تُفتح بمعرّف المحادثة الحقيقي: /orders/conversation?conversation_id=...&name=...
// ===============================================================

import { AgreementBubble } from '@/components/orders/AgreementBubble';
import { ChatBubble } from '@/components/orders/ChatBubble';
import { ChatInput } from '@/components/orders/ChatInput';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useConversation } from '@/hooks/use-conversation';
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
  Platform,
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

  const conversationId = typeof params.conversation_id === 'string' ? params.conversation_id : '';
  const otherName = typeof params.name === 'string' && params.name ? params.name : 'محادثة';
  const myId = user?.id ?? null;

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [sharePhone, setSharePhone] = useState(false);

  const { messages, send, retry, partnerTyping, notifyTyping, loadFailed } = useConversation({
    conversationId: conversationId || null,
    myId,
  });

  // ---------- الاتفاق: مقدم الخدمة يوافق/يرفض من هنا (كله عبر Supabase) ----------
  const [agreement, setAgreement] = useState<DbAgreement | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const loadAgreement = useCallback(async () => {
    if (!conversationId) return;
    const result = await getConversationAgreement(conversationId);
    if (result !== undefined) setAgreement(result);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !myId) return;
    // الاشتراك يستدعي loadAgreement عند أول اتصال وعند كل تغيّر/إعادة اتصال
    return subscribeToAgreementChanges(() => void loadAgreement(), { conversationId });
  }, [conversationId, myId, loadAgreement]);

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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            pendingForMe ? (
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

        <ChatInput onSend={(text) => void send(text)} onChangeText={notifyTyping} />
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
  statusText: {
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
  },
});
