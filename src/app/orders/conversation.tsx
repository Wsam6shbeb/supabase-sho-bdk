// ===============================================================
// شاشة محادثة عامة مبنية بالكامل على Supabase (تعمل للطرفين: طالب الخدمة ومقدم الخدمة).
// تُفتح بمعرّف المحادثة الحقيقي: /orders/conversation?conversation_id=...&name=...
// ===============================================================

import { ChatBubble } from '@/components/orders/ChatBubble';
import { ChatInput } from '@/components/orders/ChatInput';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/services/api';
import {
  fetchMessages,
  sendMessage,
  subscribeToMessages,
  type DbMessage,
} from '@/services/chat';
import type { ChatMessage } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const toChat = (m: DbMessage): ChatMessage => ({
    id: m.id,
    order_id: '',
    sender_id: m.message_type === 'system' ? 'system' : m.sender_id === myId ? 'me' : m.sender_id,
    receiver_id: '',
    content: m.body,
    is_system: m.message_type === 'system',
    created_at: m.created_at,
    read_at: null,
  });

  const merge = (incoming: DbMessage[]) =>
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) {
        if (m.client_dedupe_key) byId.delete(m.client_dedupe_key); // استبدال الرسالة المؤقتة
        byId.set(m.id, toChat(m));
      }
      return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
    });

  useEffect(() => {
    if (!conversationId || !myId) return;
    let cancelled = false;

    void fetchMessages(conversationId).then((rows) => {
      if (!cancelled) merge(rows);
    });
    const unsubscribe = subscribeToMessages(conversationId, (row) => {
      if (!cancelled) merge([row]);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, myId]);

  const handleSend = async (text: string) => {
    if (!conversationId || !myId) return;
    const clientKey = api.randomId('msg');

    setMessages((prev) => [
      ...prev,
      {
        id: clientKey,
        order_id: '',
        sender_id: 'me',
        receiver_id: '',
        content: text,
        is_system: false,
        created_at: new Date().toISOString(),
        read_at: null,
      },
    ]);

    const { message, error } = await sendMessage({
      conversationId,
      senderId: myId,
      body: text,
      clientKey,
    });

    if (error && error !== 'DUPLICATE') {
      setMessages((prev) => prev.filter((m) => m.id !== clientKey));
      Alert.alert('', 'تعذر إرسال الرسالة. حاول مرة أخرى.');
      return;
    }
    if (message) merge([message]);
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
          renderItem={({ item }) => <ChatBubble message={item} isMine={item.sender_id === 'me'} />}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <ChatInput onSend={handleSend} />
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
});
