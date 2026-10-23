// ===============================================================
// Hook موحّد لأي محادثة مبنية على Supabase (يستخدمه الطرفان).
// يتولى: تحميل السجل، الريال تايم، الإرسال التفاؤلي، حالات الرسالة
// (جاري الإرسال / أُرسلت / وصلت / قُرئت / فشلت)، إعادة المحاولة، "يكتب الآن"،
// إعادة المزامنة عند عودة الاتصال، وتعليم القراءة عندما تكون الشاشة مفتوحة.
// ===============================================================

import { api } from '@/services/api';
import {
  createTypingChannel,
  fetchMessages,
  getConversationWriteStatus,
  markMessagesRead,
  sendMessage,
  subscribeToMessages,
  type DbMessage,
  type WriteStatus,
} from '@/services/chat';
import type { ChatMessage, MessageStatus } from '@/types/orders';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { containsPhoneNumber } from '@/domain/chatSafety';

interface Options {
  conversationId: string | null;
  myId: string | null;
  /** يُستدعى عند الإرسال إذا لم يكن معرّف المحادثة جاهزاً بعد (مثلاً تأخّر فتحها). */
  ensureConversationId?: () => Promise<string | null>;
}

const TYPING_REFRESH_MS = 2500;
const TYPING_IDLE_MS = 3000;
const PARTNER_TYPING_TIMEOUT_MS = 4500;

// نص رسالة طلب التوثيق المخزّن في قاعدة البيانات.
const VERIFICATION_REQUEST_BODY = 'طُلب من الطرف الآخر توثيق حسابه لزيادة الأمان.';

export function useConversation({ conversationId, myId, ensureConversationId }: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [writeStatus, setWriteStatus] = useState<WriteStatus | null>(null);

  const myIdRef = useRef(myId);
  const convRef = useRef(conversationId);

  useEffect(() => {
    myIdRef.current = myId;
    convRef.current = conversationId;
  }, [myId, conversationId]);

  // هل أستطيع الكتابة؟ (حظر من أحد الطرفين، أو محادثة مغلقة). السيرفر هو مصدر الحقيقة.
  const refreshWriteStatus = useCallback(async (): Promise<WriteStatus | null> => {
    const id = convRef.current;
    if (!id) return null;
    const status = await getConversationWriteStatus(id);
    if (status === undefined) return null; // فشل الاتصال: نبقي الحالة السابقة
    setWriteStatus(status);
    return status;
  }, []);

  // ---------- التحويل من صف قاعدة البيانات إلى رسالة للواجهة ----------
  const toChat = useCallback((m: DbMessage): ChatMessage => {
    const mine = m.sender_id === myIdRef.current;
    let status: MessageStatus | undefined;
    if (mine) status = m.read_at ? 'read' : m.delivered_at ? 'delivered' : 'sent';
    const content =
      m.message_type === 'system' && m.body === VERIFICATION_REQUEST_BODY
        ? mine
          ? 'طلبنا من الطرف الآخر أن يوثّق حسابه.'
          : 'طلب الطرف الآخر أن توثّق حسابك.'
        : m.body;
    return {
      id: m.id,
      order_id: '',
      sender_id: m.message_type === 'system' ? 'system' : mine ? 'me' : m.sender_id,
      receiver_id: '',
      content,
      is_system: m.message_type === 'system',
      created_at: m.created_at,
      delivered_at: m.delivered_at,
      read_at: m.read_at,
      status,
    };
  }, []);

  // ---------- دمج رسائل قادمة (جديدة أو محدّثة) ----------
  const upsert = useCallback(
    (incoming: DbMessage[]) => {
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const m of incoming) {
          // الرسالة المؤقتة تحمل id = clientKey، فنستبدلها بالحقيقية
          if (m.client_dedupe_key) byId.delete(m.client_dedupe_key);
          byId.set(m.id, toChat(m));
        }
        return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    },
    [toChat],
  );

  // ---------- تعليم القراءة (فقط والتطبيق ظاهر على الشاشة) ----------
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRead = useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      const id = convRef.current;
      if (id && AppState.currentState === 'active') void markMessagesRead(id);
    }, 300);
  }, []);

  // ---------- التحميل + الريال تايم ----------
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setMessages([]);
        setPartnerTyping(false);
        setLoadFailed(false);
        setWriteStatus(null);
      }
    });
    if (!conversationId || !myId) {
      return () => {
        cancelled = true;
      };
    }

    const sync = async () => {
      void refreshWriteStatus();
      const rows = await fetchMessages(conversationId);
      if (cancelled) return;
      if (rows === null) {
        setLoadFailed(true);
        return;
      }
      setLoadFailed(false);
      upsert(rows);
      if (rows.some((r) => r.sender_id !== myId && !r.read_at)) flushRead();
    };

    void sync();

    const unsubscribe = subscribeToMessages(conversationId, {
      onInsert: (row) => {
        if (cancelled) return;
        upsert([row]);
        if (row.sender_id !== myId) flushRead();
      },
      onUpdate: (row) => {
        if (!cancelled) upsert([row]);
      },
      // كل (إعادة) اتصال: نعيد جلب ما فاتنا أثناء انقطاع الاتصال
      onSubscribed: () => {
        if (!cancelled) void sync();
      },
    });

    // عند عودة التطبيق للواجهة: مزامنة + تعليم القراءة
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !cancelled) void sync();
    });

    return () => {
      cancelled = true;
      unsubscribe();
      appSub.remove();
      if (readTimer.current) clearTimeout(readTimer.current);
    };
  }, [conversationId, myId, upsert, flushRead, refreshWriteStatus]);

  // ---------- "يكتب الآن" ----------
  const typingRef = useRef<ReturnType<typeof createTypingChannel> | null>(null);
  const partnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId || !myId) return;
    const channel = createTypingChannel(conversationId, myId, (typing) => {
      setPartnerTyping(typing);
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
      if (typing) {
        partnerTimer.current = setTimeout(() => setPartnerTyping(false), PARTNER_TYPING_TIMEOUT_MS);
      }
    });
    typingRef.current = channel;
    return () => {
      channel.close();
      typingRef.current = null;
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [conversationId, myId]);

  /** يُستدعى مع كل تغيير في حقل الكتابة. */
  const notifyTyping = useCallback((text: string) => {
    const channel = typingRef.current;
    if (!channel) return;
    if (!text.trim()) {
      channel.send(false);
      lastTypingSent.current = 0;
      return;
    }
    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_REFRESH_MS) {
      channel.send(true);
      lastTypingSent.current = now;
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      channel.send(false);
      lastTypingSent.current = 0;
    }, TYPING_IDLE_MS);
  }, []);

  // ---------- الإرسال ----------
  const setStatus = useCallback((id: string, status: MessageStatus) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }, []);

  const deliver = useCallback(
    async (clientKey: string, text: string) => {
      let convId = convRef.current;
      if (!convId && ensureConversationId) convId = await ensureConversationId();
      const sender = myIdRef.current;

      if (!convId || !sender) {
        setStatus(clientKey, 'failed');
        return;
      }

      const { message, error } = await sendMessage({
        conversationId: convId,
        senderId: sender,
        body: text,
        clientKey,
      });

      if (error && error !== 'DUPLICATE') {
        if (error.includes('PHONE_NUMBER_NOT_ALLOWED')) {
          setMessages((prev) => prev.filter((m) => m.id !== clientKey));
          Alert.alert(
            'تعذّر إرسال الرسالة',
            'مشاركة أرقام الهاتف داخل المحادثة غير مسموحة. تابع التواصل والاتفاق من خلال التطبيق.',
          );
          return;
        }
        console.error('[chat] فشل إرسال الرسالة:', error);
        // إن كان السبب أن المحادثة لم تعد قابلة للكتابة (حظر/إغلاق) فلا فائدة من إعادة المحاولة:
        // نزيل الرسالة المؤقتة وتظهر واجهة المنع بدلاً منها
        const status = await refreshWriteStatus();
        if (status && !status.writable) {
          setMessages((prev) => prev.filter((m) => m.id !== clientKey));
        } else {
          setStatus(clientKey, 'failed');
        }
        return;
      }
      if (message) upsert([message]);
      // DUPLICATE: الرسالة وصلت سابقاً وستأتي عبر الريال تايم/المزامنة التالية
      else void fetchMessages(convId).then((rows) => rows && upsert(rows));
    },
    [ensureConversationId, setStatus, upsert, refreshWriteStatus],
  );

  const send = useCallback(
    async (text: string) => {
      if (containsPhoneNumber(text)) {
        Alert.alert(
          'مشاركة أرقام الهاتف غير مسموحة',
          'اكتب رسالتك بدون رقم هاتف، وتابع الاتفاق من خلال التطبيق.',
        );
        return;
      }
      const clientKey = api.randomId('msg');
      typingRef.current?.send(false);
      lastTypingSent.current = 0;

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
          delivered_at: null,
          read_at: null,
          status: 'sending',
        },
      ]);
      await deliver(clientKey, text);
    },
    [deliver],
  );

  /** إعادة محاولة رسالة فشلت (بنفس المفتاح، فلا تتكرر إن كانت قد وصلت فعلاً). */
  const retry = useCallback(
    async (id: string) => {
      const failed = messages.find((m) => m.id === id && m.status === 'failed');
      if (!failed) return;
      setStatus(id, 'sending');
      await deliver(id, failed.content);
    },
    [messages, deliver, setStatus],
  );

  return { messages, send, retry, partnerTyping, notifyTyping, loadFailed, writeStatus, refreshWriteStatus };
}
