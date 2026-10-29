/// <reference types="jest" />
// ===============================================================
// اختبارات وحدة لخدمة الدردشة (fetchMyConversations).
// الغرض: إثبات أن الفشل (شبكة/خادم) يعود بـ null ليميّز عن القائمة الفارغة فعلاً [].
// ===============================================================

import { fetchMyConversations, type InboxConversation } from '@/services/chat';
import { supabase } from '@/services/supabase';

jest.mock('@/services/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

jest.mock('@/services/networkStatus', () => ({
  logFetchFailure: jest.fn(),
}));

const rpcMock = supabase.rpc as unknown as jest.Mock;

const providerConversation: InboxConversation = {
  conversation_id: 'c1',
  request_id: 'r1',
  state: 'open',
  my_role: 'provider',
  other_user_id: 'u2',
  other_name: 'أحمد',
  other_avatar_url: null,
  other_region: null,
  other_verification_status: null,
  request_text: 'طلب خدمة',
  last_message_body: 'مرحبا',
  last_message_at: '2026-01-01T00:00:00.000Z',
  last_message_sender: 'u2',
  unread_count: 1,
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('fetchMyConversations', () => {
  it('يعيد قائمة المحادثات عند نجاح الطلب', async () => {
    rpcMock.mockResolvedValueOnce({ data: [providerConversation], error: null });

    const result = await fetchMyConversations();

    expect(result).toHaveLength(1);
    expect(result?.[0].conversation_id).toBe('c1');
  });

  it('يعيد null عند فشل الطلب (انقطاع الشبكة/خطأ الخادم)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'network request failed' } });

    const result = await fetchMyConversations();

    expect(result).toBeNull();
  });

  it('يعيد قائمة فارغة [] عند نجاح الطلب بلا محادثات (ليست فشلاً)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await fetchMyConversations();

    expect(result).toEqual([]);
    expect(result).not.toBeNull();
  });
});
