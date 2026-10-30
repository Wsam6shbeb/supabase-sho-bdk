/// <reference types="jest" />
// ===============================================================
// اختبارات شاشة الرسائل (MessagesTab).
// الغرض: إثبات أن فشل تحميل صندوق الوارد يُميَّز عن القائمة الفارغة،
// وأن محادثات الطرفين (طالب الخدمة ومقدم الخدمة) تظهر، مع الحفظ وإعادة
// الجلب عند عودة الاتصال، ومنع تكرار المحادثة الظاهرة أصلاً.
// ===============================================================

import MessagesTab from '@/app/(drawer)/(tabs)/messages';
import { useOrder } from '@/context/OrderContext';
import {
  archiveConversation,
  fetchMyArchivedConversationIds,
  fetchMyConversations,
  subscribeToInbox,
  unarchiveConversation,
  type InboxConversation,
} from '@/services/chat';
import { isOffline, subscribeNetworkStatus } from '@/services/networkStatus';
import { ChatStatus } from '@/types/common';
import type { ChatThread, ServiceProvider } from '@/types/orders';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/services/chat', () => ({
  fetchMyConversations: jest.fn(),
  fetchMyArchivedConversationIds: jest.fn(),
  archiveConversation: jest.fn(),
  unarchiveConversation: jest.fn(),
  subscribeToInbox: jest.fn(() => () => {}),
}));

jest.mock('@/services/networkStatus', () => ({
  isOffline: jest.fn(),
  subscribeNetworkStatus: jest.fn(() => () => {}),
}));

jest.mock('@/context/OrderContext', () => ({
  useOrder: jest.fn(),
}));

jest.mock('@/i18n/ar', () => ({ t: (key: string) => key }));

jest.mock('@/hooks/use-theme', () => ({ useTheme: () => 'light' }));

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

const fetchMyConversationsMock = fetchMyConversations as jest.MockedFunction<
  typeof fetchMyConversations
>;
const fetchMyArchivedConversationIdsMock = fetchMyArchivedConversationIds as jest.MockedFunction<
  typeof fetchMyArchivedConversationIds
>;
const archiveConversationMock = archiveConversation as jest.MockedFunction<typeof archiveConversation>;
const unarchiveConversationMock = unarchiveConversation as jest.MockedFunction<typeof unarchiveConversation>;
const subscribeToInboxMock = subscribeToInbox as jest.MockedFunction<typeof subscribeToInbox>;
const isOfflineMock = isOffline as jest.MockedFunction<typeof isOffline>;
const subscribeNetworkStatusMock = subscribeNetworkStatus as jest.MockedFunction<
  typeof subscribeNetworkStatus
>;
const useOrderMock = useOrder as unknown as jest.Mock;

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

const requesterConversation: InboxConversation = {
  ...providerConversation,
  conversation_id: 'c2',
  request_id: 'r2',
  my_role: 'requester',
  other_user_id: 'u9',
  other_name: 'سامر',
};

const activeThread: ChatThread = {
  id: 'conv_c1',
  conversation_id: 'c1',
  order_id: 'r1',
  provider_id: 'u2',
  customer_id: 'me',
  status: ChatStatus.ACTIVE,
  last_message: null,
  unread_count: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const activeProvider = {
  id: 'u2',
  name: 'خالد',
  card_color: '#3B82F6',
} as unknown as ServiceProvider;

beforeEach(() => {
  fetchMyArchivedConversationIdsMock.mockResolvedValue([]);
  archiveConversationMock.mockResolvedValue({ ok: true });
  unarchiveConversationMock.mockResolvedValue({ ok: true });
  isOfflineMock.mockReturnValue(false);
  useOrderMock.mockReturnValue({ activeChats: [], allProviders: [], orderHistory: [] });
});

describe('MessagesTab — حالات تحميل صندوق الوارد', () => {
  it('يعرض حالة الخطأ عند فشل التحميل (لا يعرضها كقائمة فارغة)', async () => {
    fetchMyConversationsMock.mockResolvedValue(null);
    isOfflineMock.mockReturnValue(true);

    const screen = render(<MessagesTab />);

    await waitFor(() => expect(screen.getByText('messages.loadFailedTitle')).toBeTruthy());
    expect(screen.queryByText('messages.empty')).toBeNull();
  });

  it('يعرض الحالة الفارغة عند نجاح الطلب بلا محادثات', async () => {
    fetchMyConversationsMock.mockResolvedValue([]);

    const screen = render(<MessagesTab />);

    await waitFor(() => expect(screen.getByText('messages.empty')).toBeTruthy());
    expect(screen.queryByText('messages.loadFailedTitle')).toBeNull();
  });

  it('يعرض محادثات مقدم الخدمة الواردة عند نجاح التحميل', async () => {
    fetchMyConversationsMock.mockResolvedValue([providerConversation]);

    const screen = render(<MessagesTab />);

    await waitFor(() => expect(screen.getByText('أحمد')).toBeTruthy());
    expect(screen.queryByText('messages.loadFailedTitle')).toBeNull();
  });

  it('يعرض محادثات طالب الخدمة أيضاً (كلا الدورين)', async () => {
    fetchMyConversationsMock.mockResolvedValue([requesterConversation]);

    const screen = render(<MessagesTab />);

    await waitFor(() => expect(screen.getByText('سامر')).toBeTruthy());
    expect(screen.queryByText('messages.empty')).toBeNull();
  });

  it('لا يكرّر محادثة تظهر مسبقاً في القائمة المحلية', async () => {
    fetchMyConversationsMock.mockResolvedValue([providerConversation]);
    useOrderMock.mockReturnValue({
      activeChats: [activeThread],
      allProviders: [activeProvider],
      orderHistory: [],
    });

    const screen = render(<MessagesTab />);

    await waitFor(() => expect(screen.getByText('خالد')).toBeTruthy());
    expect(screen.queryByText('أحمد')).toBeNull();
  });

  it('يعيد الجلب تلقائياً عند عودة الاتصال ويُخفي الخطأ', async () => {
    fetchMyConversationsMock.mockResolvedValueOnce(null);
    isOfflineMock.mockReturnValue(true);

    const screen = render(<MessagesTab />);
    await waitFor(() => expect(screen.getByText('messages.loadFailedTitle')).toBeTruthy());

    // نحاكي عودة الاتصال: الجلب التالي ينجح، ثم نُطلق حدث عودة الشبكة
    fetchMyConversationsMock.mockResolvedValue([providerConversation]);
    const listener = subscribeNetworkStatusMock.mock.calls[0][0];
    await act(async () => {
      listener(false);
    });

    await waitFor(() => expect(screen.getByText('أحمد')).toBeTruthy());
    expect(screen.queryByText('messages.loadFailedTitle')).toBeNull();
  });
  it('ينقل المحادثة إلى الأرشيف عند الضغط على زر الأرشفة', async () => {
    fetchMyConversationsMock.mockResolvedValue([providerConversation]);

    const screen = render(<MessagesTab />);
    await waitFor(() => expect(screen.getByText('أحمد')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('messages.archive'));
    await waitFor(() => expect(archiveConversationMock).toHaveBeenCalledWith('c1'));
    expect(screen.queryByText('أحمد')).toBeNull();

    fireEvent.press(screen.getByLabelText('messages.archiveTitle'));
    await waitFor(() => expect(screen.getByText('أحمد')).toBeTruthy());
  });

  it('يعيد المحادثة من الأرشيف عند إلغاء الأرشفة', async () => {
    fetchMyConversationsMock.mockResolvedValue([providerConversation]);
    fetchMyArchivedConversationIdsMock.mockResolvedValue(['c1']);

    const screen = render(<MessagesTab />);
    await waitFor(() => expect(screen.getByText('أحمد')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('messages.unarchive'));
    await waitFor(() => expect(unarchiveConversationMock).toHaveBeenCalledWith('c1'));
    expect(screen.queryByText('أحمد')).toBeNull();
  });

});
