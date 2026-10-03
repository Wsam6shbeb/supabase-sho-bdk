// ===============================================================
// شاشة محادثة عامة مبنية بالكامل على Supabase (تعمل للطرفين: طالب الخدمة ومقدم الخدمة).
// تُفتح بمعرّف المحادثة الحقيقي: /orders/conversation?conversation_id=...&name=...
// ===============================================================

import { ChatBubble } from '@/components/orders/ChatBubble';
import { ChatInput } from '@/components/orders/ChatInput';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useConversation } from '@/hooks/use-conversation';
import type { ChatMessage } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
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

export default function ConversationScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const conversationId = typeof params.conversation_id === 'string' ? params.conversation_id : '';
  const otherName = typeof params.name === 'string' && params.name ? params.name : 'محادثة';
  const myId = user?.id ?? null;

  const listRef = useRef<FlatList<ChatMessage>>(null);

  const { messages, send, retry, partnerTyping, notifyTyping, loadFailed } = useConversation({
    conversationId: conversationId || null,
    myId,
  });

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
