// ===============================================================
// استعادة محادثات طالب الخدمة من Supabase عند فتح التطبيق.
// الحالة المحلية (الطلب الحالي، المحادثات، مقدمو الخدمة) كانت تضيع عند إعادة التشغيل
// رغم أن الرسائل محفوظة. هنا نبنيها من جديد من القاعدة لآخر طلب مفتوح.
// ===============================================================

import { buildProviderServiceInfo } from '@/domain/providerServices';
import { getConversationAgreement, type DbAgreement } from '@/services/agreements';
import { fetchMyConversations, type InboxConversation } from '@/services/chat';
import { logFetchFailure } from '@/services/networkStatus';
import { supabase } from '@/services/supabase';
import { ChatStatus, OrderStatus } from '@/types/common';
import type { ChatThread, Order, ServiceProvider } from '@/types/orders';

export interface HydratedChats {
  order: Order;
  threads: ChatThread[];
  providers: ServiceProvider[];
  /** مقدم الخدمة الذي بدأ معه اتفاق (قيد الموافقة أو فعّال) إن وُجد. */
  agreedProviderId: string | null;
  /** الاتفاق القائم (بانتظار الموافقة أو فعّال) لهذا الطلب إن وُجد. */
  agreement: DbAgreement | null;
}

// حالات الطلب التي ما زالت "مفتوحة" ويجب استعادتها
// (التطبيق لا ينقل الطلب من submitted بعد المطابقة حالياً، فنعتبرها مفتوحة أيضاً)
const OPEN_REQUEST_STATES = [
  'submitted',
  'clarification',
  'matching',
  'candidates_ready',
  'negotiating',
  'agreement_pending_provider',
  'active',
];

function mapChatStatus(state: string): ChatStatus {
  switch (state) {
    case 'agreement_pending':
      return ChatStatus.AWAITING_APPROVAL;
    case 'active':
      return ChatStatus.ACTIVE;
    case 'locked_temp':
      return ChatStatus.LOCKED_NOT_CHOSEN;
    case 'read_only':
      return ChatStatus.LOCKED_COMPLETED;
    default:
      return ChatStatus.NEGOTIATING;
  }
}

function mapOrderStatus(state: string): OrderStatus {
  switch (state) {
    case 'agreement_pending_provider':
      return OrderStatus.AWAITING_AGREEMENT;
    case 'active':
      return OrderStatus.ACTIVE;
    case 'completion_pending_rating':
      return OrderStatus.COMPLETION_PENDING_RATING;
    case 'completed':
      return OrderStatus.COMPLETED;
    case 'cancelled':
    case 'expired':
      return OrderStatus.CANCELLED;
    default:
      return OrderStatus.POSTED;
  }
}

function mapVerification(status: string | null): ServiceProvider['verification_status'] {
  return status === 'approved' ? 'verified' : 'not_verified';
}

/** يرجع null إذا لا توجد محادثات مفتوحة لاستعادتها (أو عند الفشل). */
export async function loadMyConversations(userId: string): Promise<HydratedChats | null> {
  try {
    // هذه الاستعادة تبني حالة الطلب المحلية القديمة، وهي مهيأة لطالب الخدمة فقط.
    // محادثات المستخدم بصفته الطرف الآخر تُفتح من صندوق الوارد عبر conversation_id الحقيقي،
    // ولا يجوز تحويل الطرف الآخر تلقائياً إلى مقدم خدمة داخل OrderContext.
    const allInbox = await fetchMyConversations();
    // فشل الجلب (شبكة/خادم): نُرجع null كما هو عقد الدالة (لا نبني حالة محلية خاطئة)
    if (!allInbox) return null;
    const inbox = allInbox.filter((conversation) => conversation.my_role === 'requester');
    if (inbox.length === 0) return null;

    const requestIds = Array.from(new Set(inbox.map((c) => c.request_id)));
    const { data: requests, error: requestsError } = await supabase
      .from('service_requests')
      .select('id, requester_id, raw_text, state, urgency, region, created_at, updated_at')
      .in('id', requestIds);

    if (requestsError || !requests?.length) {
      if (requestsError) logFetchFailure('hydrate', 'فشل جلب الطلبات', requestsError);
      return null;
    }

    // آخر طلب ما زال مفتوحاً (المحادثات في التطبيق تخص طلباً واحداً في كل مرة)
    const openRequest = requests
      .filter((r) => OPEN_REQUEST_STATES.includes(r.state))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!openRequest) return null;

    const conversations: InboxConversation[] = inbox.filter((c) => c.request_id === openRequest.id);
    const providerIds = conversations.map((c) => c.other_user_id);

    const [profilesResult, servicesResult] = await Promise.all([
      supabase
        .from('provider_profiles')
        .select('user_id, rating_avg, rating_count, completed_services_count, is_available')
        .in('user_id', providerIds),
      supabase
        .from('provider_services')
        .select('provider_id, description, structured_data, is_active')
        .in('provider_id', providerIds)
        .eq('is_active', true),
    ]);

    if (profilesResult.error) {
      logFetchFailure('hydrate', 'فشل جلب ملفات مقدمي الخدمة', profilesResult.error);
    }
    if (servicesResult.error) {
      logFetchFailure('hydrate', 'فشل جلب خدمات مقدمي الخدمة', servicesResult.error);
    }

    // الاتفاق القائم للطلب (وإنهاء مهلته تلقائياً إذا انتهت)
    const loadAgreement = async () => {
      const { data } = await supabase
        .from('agreements')
        .select('*')
        .eq('request_id', openRequest.id)
        .in('state', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);
      return (data?.[0] as DbAgreement | undefined) ?? null;
    };
    let agreement = await loadAgreement();
    if (agreement && agreement.state === 'pending' && new Date(agreement.expires_at) < new Date()) {
      await getConversationAgreement(agreement.conversation_id); // ينهيها في السيرفر
      agreement = await loadAgreement();
    }

    const order: Order = {
      id: openRequest.id,
      customer_id: openRequest.requester_id,
      my_role: conversations[0]?.my_role === 'provider' ? 'provider' : 'customer',
      other_user_id: conversations[0]?.other_user_id ?? null,
      other_user_name: conversations[0]?.other_name ?? null,
      description: openRequest.raw_text,
      is_urgent: openRequest.urgency === 'urgent',
      status: mapOrderStatus(openRequest.state),
      region_id: openRequest.region ?? '',
      created_at: openRequest.created_at,
      updated_at: openRequest.updated_at,
      provider_id: agreement?.provider_id ?? (conversations[0]?.my_role === 'provider' ? userId : null),
      provider_name: null,
      commission_amount: agreement ? Number(agreement.commission_amount) : null,
      agreed_price: agreement?.price != null ? Number(agreement.price) : null,
    };

    const providers: ServiceProvider[] = conversations.map((c) => {
      const profile = (profilesResult.data ?? []).find((p) => p.user_id === c.other_user_id);
      const rawServices = (servicesResult.data ?? [])
        .filter((s) => s.provider_id === c.other_user_id)
        .map((s) => s.structured_data ?? { service: s.description });
      const info = buildProviderServiceInfo(rawServices);

      return {
        id: c.other_user_id,
        name: c.other_name,
        avatar_url: c.other_avatar_url,
        region: { id: c.other_region ?? '', name_ar: c.other_region ?? '' },
        skills: info.skills,
        services: info.services,
        rating: Number(profile?.rating_avg ?? 0),
        rating_count: Number(profile?.rating_count ?? 0),
        total_orders: Number(profile?.completed_services_count ?? 0),
        completion_rate: 0,
        response_time_minutes: 0,
        cancellation_rate: 0,
        balance: 0,
        is_available: profile?.is_available ?? true,
        verification_status: mapVerification(c.other_verification_status),
        card_color: '#3B82F6',
        service_request_id: c.request_id,
      } as ServiceProvider;
    });

    const threads: ChatThread[] = conversations.map((c) => ({
      id: `conv_${c.conversation_id}`,
      conversation_id: c.conversation_id,
      order_id: c.request_id,
      provider_id: c.other_user_id,
      customer_id: 'me',
      status: mapChatStatus(c.state),
      last_message: c.last_message_body
        ? {
            id: `last_${c.conversation_id}`,
            order_id: c.request_id,
            sender_id: c.last_message_sender === userId ? 'me' : (c.last_message_sender ?? ''),
            receiver_id: '',
            content: c.last_message_body,
            is_system: false,
            created_at: c.last_message_at ?? c.updated_at,
          }
        : null,
      unread_count: c.unread_count,
      created_at: c.updated_at,
      updated_at: c.updated_at,
    }));

    const agreed = conversations.find((c) => c.state === 'agreement_pending' || c.state === 'active');
    order.provider_name = conversations[0]?.my_role === 'provider'
      ? providers.find((p) => p.id === userId)?.name ?? null
      : providers.find((p) => p.id === order.provider_id)?.name ?? null;

    return {
      order,
      threads,
      providers,
      agreedProviderId: agreed?.other_user_id ?? null,
      agreement,
    };
  } catch (err) {
    console.error('[hydrate] خطأ غير متوقع أثناء استعادة المحادثات:', err);
    return null;
  }
}
