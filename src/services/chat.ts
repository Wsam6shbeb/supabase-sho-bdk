// ===============================================================
// خدمة الدردشة عبر Supabase: فتح المحادثة، جلب الرسائل، الإرسال، الاستلام/القراءة،
// الاشتراك اللحظي (Realtime)، ومؤشر "يكتب الآن".
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
  delivered_at: string | null;
  read_at: string | null;
}

const MESSAGE_COLUMNS =
  'id, conversation_id, sender_id, body, message_type, client_dedupe_key, created_at, delivered_at, read_at';

export interface InboxConversation {
  conversation_id: string;
  request_id: string;
  state: string;
  my_role: 'requester' | 'provider';
  other_user_id: string;
  other_name: string;
  other_avatar_url: string | null;
  other_region: string | null;
  other_verification_status: string | null;
  request_text: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  unread_count: number;
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

/** جلب رسائل المحادثة بالترتيب الزمني. يرجع null عند الفشل (لنفرّق بينه وبين محادثة فارغة). */
export async function fetchMessages(
  conversationId: string,
  limit = 300,
): Promise<DbMessage[] | null> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[chat] فشل جلب الرسائل:', error.message);
    return null;
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
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: params.conversationId,
        sender_id: params.senderId,
        body: params.body,
        client_dedupe_key: params.clientKey,
      })
      .select(MESSAGE_COLUMNS)
      .single();

    if (error) {
      // 23505 = نفس client_dedupe_key أُرسل سابقاً (الرسالة موجودة فعلاً)
      return { message: null, error: error.code === '23505' ? 'DUPLICATE' : error.message };
    }
    return { message: data as DbMessage, error: null };
  } catch (err) {
    return { message: null, error: err instanceof Error ? err.message : 'NETWORK_ERROR' };
  }
}

/** تعليم رسائل الطرف الآخر في هذه المحادثة بأنها قُرئت. */
export async function markMessagesRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_read', { p_conversation_id: conversationId });
  if (error) console.error('[chat] فشل تعليم القراءة:', error.message);
}

/** تعليم رسائل الطرف الآخر في هذه المحادثة بأنها وصلت. */
export async function markMessagesDelivered(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_delivered', {
    p_conversation_id: conversationId,
  });
  if (error) console.error('[chat] فشل تعليم الاستلام:', error.message);
}

/** عند فتح التطبيق: كل ما وصلني أثناء غيابي يصبح "وصلت". */
export async function markAllMyMessagesDelivered(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_my_messages_delivered');
  if (error) console.error('[chat] فشل تعليم الاستلام الجماعي:', error.message);
}

/**
 * اشتراك لحظي برسائل المحادثة: الجديدة (INSERT) وتغيّر حالتها (UPDATE: وصلت/قُرئت).
 * onSubscribed يُستدعى عند كل اتصال/إعادة اتصال لنعيد مزامنة ما فاتنا.
 */
export function subscribeToMessages(
  conversationId: string,
  handlers: {
    onInsert: (message: DbMessage) => void;
    onUpdate: (message: DbMessage) => void;
    onSubscribed?: () => void;
  },
): () => void {
  const filter = `conversation_id=eq.${conversationId}`;
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter },
      (payload) => handlers.onInsert(payload.new as DbMessage),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter },
      (payload) => handlers.onUpdate(payload.new as DbMessage),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') handlers.onSubscribed?.();
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** قناة "يكتب الآن" عبر Broadcast (لا تُخزَّن في القاعدة). */
export function createTypingChannel(
  conversationId: string,
  myId: string,
  onPartnerTyping: (typing: boolean) => void,
) {
  const channel = supabase
    .channel(`typing:${conversationId}`)
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.user_id && payload.user_id !== myId) onPartnerTyping(!!payload.typing);
    })
    .subscribe();

  return {
    send(typing: boolean) {
      void channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: myId, typing } });
    },
    close() {
      void supabase.removeChannel(channel);
    },
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

/** اشتراك لحظي بأي رسالة جديدة أو تغيّر حالة تخصني (لتحديث صندوق الوارد والعدّاد). */
export function subscribeToInbox(onChange: () => void): () => void {
  const channel = supabase
    .channel('inbox')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export interface WriteStatus {
  writable: boolean;
  /** blocked_by_me: أنا حظرته | unavailable: غير متاحة (لا نكشف للمحظور أنه محظور) | closed: انتهت المراسلة */
  reason: 'blocked_by_me' | 'unavailable' | 'closed' | null;
  other_user_id: string;
}

/** هل أستطيع الكتابة في هذه المحادثة ولماذا؟ undefined عند فشل الاتصال، null إن لم أكن طرفاً فيها. */
export async function getConversationWriteStatus(
  conversationId: string,
): Promise<WriteStatus | null | undefined> {
  try {
    const { data, error } = await supabase.rpc('get_conversation_write_status', {
      p_conversation_id: conversationId,
    });
    if (error) return undefined;
    return (data as unknown as WriteStatus | null) ?? null;
  } catch {
    return undefined;
  }
}
