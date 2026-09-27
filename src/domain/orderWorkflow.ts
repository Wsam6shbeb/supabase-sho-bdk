// ===============================================================
// شرح الملف: هذا ملف يحتوي منطق العمل الأساسي (orderWorkflow).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: createOrder، createNegotiationThread، canOpenChat، lockUnselectedThreads، reopenNegotiations، resetPendingAgreement.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { ChatStatus, OrderStatus } from '@/types/common';
import { api } from '@/services/api';
import type { ChatMessage, ChatThread, Order, ServiceProvider } from '@/types/orders';

export const MAX_ACTIVE_CHATS = 3;

// [شرح الدالة: createOrder] ينشئ كائن طلب جديد ويضع بياناته الابتدائية.
export function createOrder(params: {
  description: string;
  is_urgent: boolean;
  region_id: string;
  customer_id?: string;
}): Order {
  const now = new Date().toISOString();
  return {
    id: api.randomId('ord'),
    customer_id: params.customer_id ?? 'me',
    description: params.description,
    is_urgent: params.is_urgent,
    status: OrderStatus.POSTED,
    region_id: params.region_id,
    created_at: now,
    updated_at: now,
    provider_id: null,
    provider_name: null,
    provider_card_color: null,
    commission_amount: null,
    agreed_price: null,
  };
}

// [شرح الدالة: createNegotiationThread] ينشئ مسار محادثة/تفاوض جديدًا مرتبطًا بالطلب.
export function createNegotiationThread(orderId: string, provider: ServiceProvider, welcomeMessage: ChatMessage): ChatThread {
  const now = new Date().toISOString();
  return {
    id: api.randomId('thr'),
    order_id: orderId,
    provider_id: provider.id,
    customer_id: 'me',
    status: ChatStatus.NEGOTIATING,
    last_message: welcomeMessage,
    unread_count: 0,
    created_at: now,
    updated_at: now,
  };
}

// [شرح الدالة: canOpenChat] يتحقق مما إذا كان يمكن فتح المحادثة مع الطرف المطلوب.
export function canOpenChat(activeChats: ChatThread[], providerId: string, agreedProviderId: string | null) {
  if (activeChats.some((thread) => thread.provider_id === providerId)) return 'EXISTING' as const;
  if (agreedProviderId) return 'ALREADY_AGREED' as const;
  if (activeChats.length >= MAX_ACTIVE_CHATS) return 'MAX_CHATS' as const;
  return 'OPEN' as const;
}

// [شرح الدالة: lockUnselectedThreads] يقفل مسارات التفاوض التي لم يتم اختيارها.
export function lockUnselectedThreads(threads: ChatThread[], selectedProviderId: string, message: (thread: ChatThread) => ChatMessage) {
  return threads.map((thread) =>
    thread.provider_id === selectedProviderId
      ? { ...thread, status: ChatStatus.AWAITING_APPROVAL }
      : {
          ...thread,
          status: ChatStatus.LOCKED_NOT_CHOSEN,
          last_message: message(thread),
        },
  );
}

// [شرح الدالة: reopenNegotiations] يعيد فتح مسارات التفاوض التي يسمح سير العمل بإعادة فتحها.
export function reopenNegotiations(threads: ChatThread[]) {
  return threads.map((thread) =>
    thread.status === ChatStatus.AWAITING_APPROVAL || thread.status === ChatStatus.LOCKED_NOT_CHOSEN
      ? { ...thread, status: ChatStatus.NEGOTIATING }
      : thread,
  );
}

// [شرح الدالة: resetPendingAgreement] يعيد الاتفاق المعلّق إلى حالة تسمح بمتابعة سير الطلب.
export function resetPendingAgreement(order: Order): Order {
  return {
    ...order,
    status: OrderStatus.POSTED,
    provider_id: null,
    provider_name: null,
    provider_card_color: null,
    commission_amount: null,
    updated_at: new Date().toISOString(),
  };
}
