// ===============================================================
// خدمة الدردشة عبر Supabase: فتح المحادثة، جلب الرسائل، الإرسال، والاشتراك اللحظي (Realtime).
// RLS على جداول conversations/messages تضمن أن الطرفين فقط يقرآن ويكتبان.
// ===============================================================

import { supabase } from '@/services/supabase';

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: 'text' | 'system';
  client_dedupe_key: string | null;
  created_at: string;
}

export interface InboxConversation {
  conversation_id: string;
  request_id: string;
  state: string;
  my_role: 'requester' | 'provider';
  other_user_id: string;
  other_name: string;
  other_avatar_url: string | null;
  other_region: string | null;
  request_text: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  updated_at: string;
}

/** يفتح (أو يرجع) المحادثة بين المستخدم الحالي ومقدم الخدمة لهذا الطلب. */
export async function openConversation(
  requestId: string,
  providerId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('open_conversation', {
    p_request_id: requestId,
    p_provider_id: providerId,
  });
  if (error || !data) {
    return { id: null, error: error?.message ?? 'EMPTY_RESULT' };
  }
  return { id: data as string, error: null };
}

/** جلب رسائل المحادثة بالترتيب الزمني. */
export async function fetchMessages(conversationId: string, limit = 300): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, message_type, client_dedupe_key, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[chat] فشل جلب الرسائل:', error.message);
    return [];
  }
  return (data ?? []) as DbMessage[];
}

/** إرسال رسالة نصية. clientKey يمنع التكرار عند إعادة المحاولة. */
export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
  clientKey: string;
}): Promise<{ message: DbMessage | null; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      body: params.body,
      client_dedupe_key: params.clientKey,
    })
    .select('id, conversation_id, sender_id, body, message_type, client_dedupe_key, created_at')
    .single();

  if (error) {
    // 23505 = تكرار نفس client_dedupe_key (الرسالة أُرسلت سابقاً)
    return { message: null, error: error.code === '23505' ? 'DUPLICATE' : error.message };
  }
  return { message: data as DbMessage, error: null };
}

/** اشتراك لحظي برسائل المحادثة الجديدة. يرجع دالة لإلغاء الاشتراك. */
export function subscribeToMessages(
  conversationId: string,
  onInsert: (message: DbMessage) => void,
): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert(payload.new as DbMessage),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** صندوق الوارد: كل المحادثات التي يشارك فيها المستخدم (كطالب خدمة أو كمقدم خدمة). */
export async function fetchMyConversations(): Promise<InboxConversation[]> {
  const { data, error } = await supabase.rpc('get_my_conversations');
  if (error) {
    console.error('[chat] فشل جلب المحادثات:', error.message);
    return [];
  }
  return (data ?? []) as InboxConversation[];
}

/** اشتراك لحظي بأي رسالة جديدة تخص المستخدم (لتحديث صندوق الوارد). */
export function subscribeToInbox(onChange: () => void): () => void {
  const channel = supabase
    .channel('inbox')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
