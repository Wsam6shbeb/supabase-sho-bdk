// ===============================================================
// شرح الملف: هذا Context لإدارة الحالة المشتركة (OrderContext).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: systemMessage، OrderProvider، loadWallet، tick، checkRatingDeadlines، useOrder.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// Context لإدارة الطلبات، المحادثات، الرصيد، والإشعارات
// ═══════════════════════════════════════════════════════════

import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { useChatDelivery } from '@/hooks/use-chat-delivery';
import { openConversation } from '@/services/chat';
import { loadRequesterConversations } from '@/services/hydrateChats';
import { ChatStatus, OrderStatus } from '@/types/common';
import { BUSINESS_CONFIG } from '@/config/business';
import { estimateCommissionFromChat, extractPriceFromChat } from '@/domain/commission';
import { canOpenChat, createNegotiationThread, createOrder, lockUnselectedThreads, reopenNegotiations, resetPendingAgreement } from '@/domain/orderWorkflow';
import type { AppNotification } from '@/types/notifications';
import type { Json } from '@/types/database';
import type {
    ChatMessage,
    ChatThread,
    Order,
    RatingDto,
    ServiceProvider,
} from '@/types/orders';
import type { CreateNonExecutionReportDto, CreateReportDto, Report } from '@/types/reports';
import { useOrderNotifications } from '@/hooks/order/useOrderNotifications';
import { useOrderSafety } from '@/hooks/order/useOrderSafety';
import { useAuth } from '@/hooks/use-auth';
import type {
    Transaction,
    TransactionReason,
    VerificationRequest,
    VerificationStatusType,
} from '@/types/wallet';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

// ═══════════════════════════════════════════════════════════
// الثوابت
// ═══════════════════════════════════════════════════════════
const WELCOME_BONUS_AMOUNT = BUSINESS_CONFIG.welcomeBonus;

const DEV_FAST_TIMERS = false;

const APPROVAL_TIMEOUT_MS = DEV_FAST_TIMERS ? 20 * 1000 : 4 * 60 * 1000;
const RATING_TIMEOUT_MS = DEV_FAST_TIMERS ? 30 * 1000 : 48 * 60 * 60 * 1000;

const LOW_BALANCE_THRESHOLD = 20;
const CRITICAL_BALANCE_THRESHOLD = 10;

// ═══════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════
export type OpenChatResult =
  | { ok: true; thread: ChatThread }
  | { ok: false; reason: 'MAX_CHATS' | 'ALREADY_AGREED' | 'BLOCKED' };

export interface ProviderSkill {
  id: string;
  name: string;
  years_of_experience?: number;
  description?: string;
  service_area?: string;
  additional_info?: string;
}

export interface MyProviderProfile {
  skills: ProviderSkill[];
  bio?: string;
  is_available: boolean;
  welcome_bonus_received: boolean;
}

export interface OrderContextValue {
  currentOrder: Order | null;
  candidates: ServiceProvider[];
  /** مرشحو البحث الحالي + مقدمو الخدمة المستعادون من المحادثات المحفوظة. */
  allProviders: ServiceProvider[];
  activeChats: ChatThread[];
  agreedProviderId: string | null;
  approvalRemainingSeconds: number;
  orderHistory: Order[];

  myProviderProfile: MyProviderProfile | null;
  hasProviderProfile: boolean;
  welcomeBonusReceived: boolean;

  balance: number;
  transactions: Transaction[];
  isLowBalance: boolean;
  isCriticalBalance: boolean;

  verificationStatus: VerificationStatusType;
  isVerified: boolean;
  verificationRequest: VerificationRequest | null;

  reports: Report[];
  blockedProviderIds: string[];

  notifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;

  hasAcceptedDisclaimer: boolean;
  acceptDisclaimer: () => void;

  startOrder: (params: {
    description: string;
    service_area: string;
    additional_info?: string;
    is_urgent: boolean;
    region_id: string;
  }) => Promise<Order>;
  setCandidates: (providers: ServiceProvider[]) => void;
  resetOrder: () => void;

  openChat: (provider: ServiceProvider) => OpenChatResult;
  closeChat: (threadId: string) => void;
  getThreadByProviderId: (providerId: string) => ChatThread | undefined;
  getProviderById: (providerId: string) => ServiceProvider | undefined;

  hasCompletedOrderWith: (providerId: string) => boolean;
  requestProviderAgain: (provider: ServiceProvider, description: string) => Order;

  customerAgrees: (
    threadId: string,
    providerId: string,
    customerName: string,
    chatHistory: ChatMessage[],
  ) => void;
  providerApproves: (threadId: string) => void;
  providerRejects: (threadId: string) => void;
  customerCancelsAgreement: () => void;

  completeOrder: () => void;
  rateOrder: (dto: RatingDto) => void;

  addFirstSkill: (skill: ProviderSkill & { price_min?: number; price_max?: number; service_area: string; additional_info?: string }) => Promise<{ welcomeBonus: boolean; clarificationQuestion?: string }>;
  updateProviderProfile: (patch: Partial<MyProviderProfile>) => void;
  toggleAvailability: () => void;

  addTransaction: (
    type: Transaction['type'],
    amount: number,
    reason: TransactionReason,
    description: string,
    extra?: { order_id?: string; counterparty_name?: string },
  ) => void;
  topUp: (amount: number, method: string) => void;

  submitVerification: (idPhotoUri: string, selfieUri: string) => void;
  resetVerification: () => void;

  submitReport: (dto: CreateReportDto) => void;
  reportNonExecution: (dto: CreateNonExecutionReportDto) => void;
  blockProvider: (providerId: string) => void;
  unblockProvider: (providerId: string) => void;
  isProviderBlocked: (providerId: string) => boolean;

  estimateCommission: (messages: ChatMessage[]) => number;
  getOrderById: (orderId: string) => Order | undefined;
}

// ═══════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════
const OrderContext = createContext<OrderContextValue | null>(null);

// ═══════════════════════════════════════════════════════════
// System messages
// ═══════════════════════════════════════════════════════════
function systemMessage(orderId: string, content: string): ChatMessage {
  return {
    id: api.randomId('msg'),
    order_id: orderId,
    sender_id: 'system',
    receiver_id: '',
    content,
    is_system: true,
    created_at: new Date().toISOString(),
    read_at: null,
  };
}

const WELCOME_TEXT =
  "يرجى التواصل بهاي المحادثة لتحديد سعر الخدمة ومدتها وباقي التفاصيل، وعند الاتفاق اضغط 'تم الاتفاق'. التطبيق مو مسؤول عن جودة أو سرعة تنفيذ الخدمة، وبتقدر تقيّم الطرف الآخر وتكتب سبب التقييم.";

// ═══════════════════════════════════════════════════════════
// Supabase sync (best-effort)
// ═══════════════════════════════════════════════════════════

async function analyzeServiceRequest(input: {
  description: string;
  serviceArea: string;
  additionalInfo?: string;
}): Promise<{
  structured_data: Json;
  ai_confidence: number | null;
  needs_clarification: boolean;
  clarification_question: string | null;
} | null> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-service-request', {
      body: {
        request_text: input.description,
        service_area: input.serviceArea,
        additional_info: input.additionalInfo ?? '',
      },
    });

    if (error) {
      console.error('[Supabase][startOrder] فشل تحليل طلب الخدمة بالذكاء الاصطناعي:', error.message);
      return null;
    }

    if (!data?.structured_data) {
      console.error('[Supabase][startOrder] تحليل طلب الخدمة لم يُرجع structured_data.');
      return null;
    }

    return {
      structured_data: data.structured_data,
      ai_confidence: typeof data.ai_confidence === 'number' ? data.ai_confidence : null,
      needs_clarification: data.needs_clarification === true,
      clarification_question:
        typeof data.clarification_question === 'string' && data.clarification_question.trim()
          ? data.clarification_question.trim()
          : null,
    };
  } catch (err) {
    console.error('[Supabase][startOrder] خطأ أثناء تحليل طلب الخدمة بالذكاء الاصطناعي:', err);
    return null;
  }
}

async function createServiceRequestInSupabase(params: {
  requesterId: string;
  description: string;
  serviceArea: string;
  additionalInfo?: string;
  isUrgent: boolean;
  regionId: string;
}): Promise<{ id: string; ai_failed: boolean }> {
  try {
    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        requester_id: params.requesterId,
        raw_text: params.description,
        service_area: params.serviceArea,
        additional_info: params.additionalInfo?.trim() || null,
        urgency: params.isUrgent ? 'urgent' : 'normal',
        region: params.regionId || null,
        state: 'submitted',
        structured_data: null,
        ai_confidence: null,
        needs_clarification: false,
        clarification_question: null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Supabase][startOrder] فشل إنشاء طلب الخدمة:', error.message, params);
      throw new Error('تعذر إنشاء طلب الخدمة في قاعدة البيانات. حاول مرة أخرى.');
    }

    console.log('[Supabase][startOrder] تم إنشاء طلب الخدمة بنجاح:', data.id);

    const analysis = await analyzeServiceRequest({
      description: params.description,
      serviceArea: params.serviceArea,
      additionalInfo: params.additionalInfo,
    });

    // ⭐ إذا فشل AI: نكمل بـ fallback بدون ما نوقف العملية
    if (!analysis) {
      console.warn('[Supabase][startOrder] تحليل AI فشل، سيتم استخدام النص الخام كـ fallback.');

      const fallbackStructuredData: Json = {
        service: params.description,
        category: null,
        skills: [],
        synonyms: [],
        region: params.serviceArea || null,
        location: null,
        service_area: {
          raw: params.serviceArea,
          city: params.serviceArea,
          type: 'city',
          areas: [],
        },
        confidence: null,
        ai_failed: true,
      };

      const { error: fallbackUpdateError } = await supabase
        .from('service_requests')
        .update({
          structured_data: fallbackStructuredData,
          ai_confidence: null,
          needs_clarification: false,
          clarification_question: null,
        })
        .eq('id', data.id)
        .eq('requester_id', params.requesterId);

      if (fallbackUpdateError) {
        console.error('[Supabase][startOrder] فشل حفظ fallback:', fallbackUpdateError.message);
      } else {
        console.log('[Supabase][startOrder] تم حفظ fallback بدون AI:', data.id);
      }

      return { id: data.id, ai_failed: true };
    }

    // ✅ AI نجح — نكمل عادي
    const { error: updateError } = await supabase
      .from('service_requests')
      .update({
        structured_data: analysis.structured_data,
        ai_confidence: analysis.ai_confidence,
        needs_clarification: analysis.needs_clarification,
        clarification_question: analysis.clarification_question,
      })
      .eq('id', data.id)
      .eq('requester_id', params.requesterId);

    if (updateError) {
      console.error('[Supabase][startOrder] فشل حفظ تحليل طلب الخدمة:', updateError.message);
      throw new Error('تعذر حفظ تحليل طلب الخدمة. حاول مرة أخرى.');
    }

    console.log('[Supabase][startOrder] تم حفظ تحليل طلب الخدمة بالذكاء الاصطناعي:', data.id);

    return { id: data.id, ai_failed: false };
  } catch (err) {
    console.error('[Supabase][startOrder] خطأ أثناء إنشاء طلب الخدمة:', err);
    if (err instanceof Error && err.message.includes('تعذر إنشاء طلب الخدمة')) {
      throw err;
    }
    throw new Error('تعذر إنشاء طلب الخدمة بسبب خطأ غير متوقع. حاول مرة أخرى.');
  }
}

async function syncOpenChatToSupabase(
  thread: ChatThread,
  orderId: string,
  providerId: string,
  requesterId: string | undefined,
): Promise<string | null> {
  try {
    if (!requesterId) {
      console.error('[Supabase][openChat] لا يوجد مستخدم مسجّل دخول، تم تجاوز إنشاء المحادثة.');
      return null;
    }

    const { id, error } = await openConversation(orderId, providerId);

    if (error || !id) {
      console.error('[Supabase][openChat] فشل فتح المحادثة:', error, {
        threadId: thread.id,
        orderId,
        providerId,
      });
      return null;
    }

    console.log('[Supabase][openChat] المحادثة جاهزة:', id);
    return id;
  } catch (err) {
    console.error('[Supabase][openChat] خطأ غير متوقع أثناء فتح المحادثة:', err);
    return null;
  }
}

async function syncAgreementToSupabase(params: {
  threadId: string;
  requestId: string;
  providerId: string;
  requesterId: string | undefined;
  price: number | null;
  commission: number;
}) {
  try {
    if (!params.requesterId) {
      console.error('[Supabase][customerAgrees] لا يوجد مستخدم مسجّل دخول، تم تجاوز إنشاء الاتفاق.');
      return;
    }

    const { data, error } = await supabase.rpc('create_agreement', {
      p_request_id: params.requestId,
      p_conversation_id: params.threadId,
      p_requester_id: params.requesterId,
      p_provider_id: params.providerId,
      p_price: params.price,
      p_price_source: params.price != null ? 'user_confirmed' : 'default',
      p_commission: params.commission,
    });

    if (error) {
      console.error('[Supabase][customerAgrees] فشل إنشاء الاتفاق:', error.message, params);
      return;
    }

    console.log('[Supabase][customerAgrees] تم إنشاء الاتفاق بنجاح:', data?.id);
  } catch (err) {
    console.error('[Supabase][customerAgrees] خطأ غير متوقع أثناء إنشاء الاتفاق:', err);
  }
}

// ═══════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════
export function OrderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  useChatDelivery(user?.id);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [candidates, setCandidatesState] = useState<ServiceProvider[]>([]);
  const [activeChats, setActiveChats] = useState<ChatThread[]>([]);
  const [agreedProviderId, setAgreedProviderId] = useState<string | null>(null);
  const [approvalDeadline, setApprovalDeadline] = useState<number | null>(null);
  const [approvalRemainingSeconds, setApprovalRemainingSeconds] = useState(0);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);

  // مقدمو خدمة تمت استعادتهم من القاعدة (لا نخلطهم مع مرشحي البحث الحالي)
  const [knownProviders, setKnownProviders] = useState<ServiceProvider[]>([]);
  const currentOrderRef = useRef<Order | null>(null);
  useEffect(() => {
    currentOrderRef.current = currentOrder;
  }, [currentOrder]);

  // استعادة آخر طلب مفتوح ومحادثاته من Supabase عند تسجيل الدخول/فتح التطبيق
  useEffect(() => {
    if (!user?.id) {
      setKnownProviders([]);
      return;
    }
    let cancelled = false;

    void loadRequesterConversations(user.id).then((result) => {
      if (cancelled || !result) return;

      // إذا بدأ المستخدم طلباً جديداً قبل انتهاء الاستعادة فلا نستبدله
      const existing = currentOrderRef.current;
      if (existing && existing.id !== result.order.id) return;

      setKnownProviders(result.providers);
      setCurrentOrder((prev) => prev ?? result.order);
      setActiveChats((prev) => [
        ...prev,
        ...result.threads.filter(
          (t) =>
            !prev.some(
              (p) =>
                p.conversation_id === t.conversation_id ||
                (p.provider_id === t.provider_id && p.order_id === t.order_id),
            ),
        ),
      ]);
      setAgreedProviderId((prev) => prev ?? result.agreedProviderId);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const [myProviderProfile, setMyProviderProfile] = useState<MyProviderProfile | null>(null);

  const loadMyProviderProfile = useCallback(async (userId: string) => {
    try {
      const [profileResult, servicesResult] = await Promise.all([
        supabase
          .from('provider_profiles')
          .select('user_id, bio, is_available')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('provider_services')
          .select('id, description, experience_years')
          .eq('provider_id', userId)
          .order('created_at', { ascending: true }),
      ]);

      if (profileResult.error) {
        console.error('[Supabase][providerProfile] فشل قراءة ملف مقدم الخدمة:', profileResult.error.message);
        return;
      }

      if (servicesResult.error) {
        console.error('[Supabase][providerServices] فشل قراءة خدمات مقدم الخدمة:', servicesResult.error.message);
        return;
      }

      if (!profileResult.data && (servicesResult.data?.length ?? 0) === 0) {
        setMyProviderProfile(null);
        return;
      }

      setMyProviderProfile({
        skills: (servicesResult.data ?? []).map((service) => ({
          id: service.id,
          name: service.description,
          years_of_experience: service.experience_years,
          description: service.description,
        })),
        bio: profileResult.data?.bio ?? undefined,
        is_available: profileResult.data?.is_available ?? true,
        welcome_bonus_received: false,
      });
    } catch (err) {
      console.error('[Supabase][providerProfile] خطأ غير متوقع أثناء تحميل ملف مقدم الخدمة:', err);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setMyProviderProfile(null);
      return;
    }
    void loadMyProviderProfile(user.id);
  }, [user?.id, loadMyProviderProfile]);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadWallet = async () => {
      if (!api.wallet) return;
      const [summary, ledger] = await Promise.all([
        api.wallet.getSummary(),
        api.wallet.getTransactions(),
      ]);
      if (cancelled) return;
      if (summary.success) setBalance(Number(summary.data.balance ?? 0));
      if (ledger.success) setTransactions(ledger.data);
    };
    void loadWallet();
    return () => { cancelled = true; };
  }, []);

  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatusType>('not_verified');
  const [verificationRequest, setVerificationRequest] =
    useState<VerificationRequest | null>(null);

  const {
    notifications,
    unreadNotificationsCount,
    pushNotification,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotification,
    clearAllNotifications,
  } = useOrderNotifications();

  const {
    reports,
    blockedProviderIds,
    submitReport,
    blockProvider,
    unblockProvider,
    isProviderBlocked,
  } = useOrderSafety();

  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!approvalDeadline) {
      setApprovalRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((approvalDeadline - Date.now()) / 1000));
      setApprovalRemainingSeconds(remaining);
      if (remaining <= 0) {
        handleTimeoutExpired();
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalDeadline]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const acceptDisclaimer = useCallback(() => {
    setHasAcceptedDisclaimer(true);
  }, []);

  const addTransaction = useCallback(
    (
      type: Transaction['type'],
      amount: number,
      reason: TransactionReason,
      description: string,
      extra?: { order_id?: string; counterparty_name?: string },
    ) => {
      setBalance((prevBalance) => {
        const newBalance =
          type === 'credit' ? prevBalance + amount : prevBalance - amount;

        const tx: Transaction = {
          id: api.randomId('tx'),
          user_id: 'me',
          type,
          amount,
          balance_after: newBalance,
          reason,
          description,
          order_id: extra?.order_id ?? null,
          counterparty_name: extra?.counterparty_name ?? null,
          created_at: new Date().toISOString(),
        };

        setTransactions((prev) => [tx, ...prev]);

        if (newBalance < CRITICAL_BALANCE_THRESHOLD && newBalance >= 0) {
          pushNotification({
            type: 'balance_low',
            title: 'رصيدك منخفض',
            body: 'رصيدك أقل من الحد الأدنى. أضف رصيداً لتستمر في استقبال الطلبات.',
            route: '/(drawer)/(tabs)/wallet',
          });
        }

        return newBalance;
      });
    },
    [pushNotification],
  );

  const topUp = useCallback(
    (amount: number, method: string) => {
      addTransaction('credit', amount, 'top_up', `إضافة رصيد عبر ${method}`);
    },
    [addTransaction],
  );

  const submitVerification = useCallback((idPhotoUri: string, selfieUri: string) => {
    const req: VerificationRequest = {
      id: api.randomId('ver'),
      user_id: 'me',
      status: 'under_review',
      submitted_at: new Date().toISOString(),
      id_photo_uri: idPhotoUri,
      selfie_photo_uri: selfieUri,
    };
    setVerificationRequest(req);
    setVerificationStatus('under_review');
  }, []);

  const resetVerification = useCallback(() => {
    setVerificationRequest(null);
    setVerificationStatus('not_verified');
  }, []);

  const handleTimeoutExpired = useCallback(() => {
    clearTimer();
    setAgreedProviderId(null);
    setApprovalDeadline(null);
    setApprovalRemainingSeconds(0);

    setCurrentOrder((prev) =>
      prev
        ? {
            ...prev,
            status: OrderStatus.POSTED,
            provider_id: null,
            commission_amount: null,
            updated_at: new Date().toISOString(),
          }
        : prev,
    );

    setActiveChats((prev) => reopenNegotiations(prev).map((thread) => ({ ...thread, updated_at: new Date().toISOString() })));

    pushNotification({
      type: 'agreement_rejected',
      title: 'انتهت مهلة الموافقة',
      body: 'تم إلغاء الاتفاق تلقائياً لأن مقدم الخدمة لم يرد.',
      route: '/(drawer)/(tabs)/orders',
    });
  }, [clearTimer, pushNotification]);

  // ═══════════════════════════════════════════════════════════
  // Order
  // ═══════════════════════════════════════════════════════════
  const startOrder = useCallback(
    async (params: { description: string; service_area: string; additional_info?: string; is_urgent: boolean; region_id: string }): Promise<Order> => {
      clearTimer();
      const requesterId = user?.id;

      if (!requesterId) {
        throw new Error('يجب تسجيل الدخول قبل إنشاء طلب الخدمة.');
      }

      const created = await createServiceRequestInSupabase({
        requesterId,
        description: params.description,
        serviceArea: params.service_area,
        additionalInfo: params.additional_info,
        isUrgent: params.is_urgent,
        regionId: params.region_id,
      });

      // ⭐ إذا فشل AI: نضيف إشعار (يظهر كـ banner بالجرس)
      if (created.ai_failed) {
        pushNotification({
          type: 'ai_unavailable',
          title: 'التحليل الذكي متوقف مؤقتاً',
          body: 'سيتم عرض النتائج بناءً على النص الخام. قد تكون أقل دقة.',
          route: '/(drawer)/(tabs)/orders',
        });
      }

      const order = {
        ...createOrder({ ...params, customer_id: requesterId }),
        id: created.id,
      };

      setCurrentOrder(order);
      setCandidatesState([]);
      setActiveChats([]);
      setAgreedProviderId(null);
      setApprovalDeadline(null);

      return order;
    },
    [clearTimer, user?.id, pushNotification],
  );

  const setCandidates = useCallback(
    (providers: ServiceProvider[]) => {
      setCandidatesState(providers.filter((p) => !blockedProviderIds.includes(p.id)));
    },
    [blockedProviderIds],
  );

  const resetOrder = useCallback(() => {
    clearTimer();
    setCurrentOrder(null);
    setCandidatesState([]);
    setActiveChats([]);
    setAgreedProviderId(null);
    setApprovalDeadline(null);
  }, [clearTimer]);

  const hasCompletedOrderWith = useCallback(
    (providerId: string) =>
      orderHistory.some(
        (o) =>
        o.provider_id === providerId &&
        (o.status === OrderStatus.COMPLETED ||
          o.status === OrderStatus.COMPLETION_PENDING_RATING),
      ),
    [orderHistory],
  );

  const requestProviderAgain = useCallback(
    (provider: ServiceProvider, description: string): Order => {
      clearTimer();

      const requesterId = user?.id;
      const order = createOrder({
        description,
        is_urgent: false,
        region_id: provider.region.id,
        customer_id: requesterId ?? 'me',
      });

      const thread = createNegotiationThread(order.id, provider, systemMessage(order.id, WELCOME_TEXT));

      setCurrentOrder(order);
      setCandidatesState([provider]);
      setActiveChats([thread]);
      setAgreedProviderId(null);
      setApprovalDeadline(null);

      if (requesterId) {
        void createServiceRequestInSupabase({
          requesterId,
          description,
          serviceArea: provider.region.name_ar || '',
          isUrgent: false,
          regionId: provider.region.id,
        }).then((created) => {
          if (!created) return;
          setCurrentOrder((prev) => (prev && prev.id === order.id ? { ...prev, id: created.id } : prev));
          void syncOpenChatToSupabase(thread, created.id, provider.id, requesterId).then((conversationId) => {
            if (!conversationId) return;
            setActiveChats((prev) =>
              prev.map((t) => (t.id === thread.id ? { ...t, conversation_id: conversationId } : t)),
            );
          });
        });
      } else {
        console.error('[Supabase][requestProviderAgain] لا يوجد مستخدم مسجّل دخول، تم تجاوز إنشاء طلب الخدمة/المحادثة.');
      }

      return order;
    },
    [clearTimer, user?.id],
  );

  // ═══════════════════════════════════════════════════════════
  // Chat
  // ═══════════════════════════════════════════════════════════
  const openChat = useCallback(
    (provider: ServiceProvider): OpenChatResult => {
      if (blockedProviderIds.includes(provider.id)) {
        return { ok: false, reason: 'BLOCKED' };
      }

      const decision = canOpenChat(activeChats, provider.id, agreedProviderId);
      if (decision === 'EXISTING') {
        return { ok: true, thread: activeChats.find((t) => t.provider_id === provider.id)! };
      }
      if (decision === 'ALREADY_AGREED') return { ok: false, reason: 'ALREADY_AGREED' };
      if (decision === 'MAX_CHATS') return { ok: false, reason: 'MAX_CHATS' };

      const orderId = currentOrder?.id ?? '';
      const thread = createNegotiationThread(orderId, provider, systemMessage(orderId, WELCOME_TEXT));

      setActiveChats((prev) => [...prev, thread]);
      void syncOpenChatToSupabase(thread, orderId, provider.id, user?.id).then((conversationId) => {
        if (!conversationId) return;
        setActiveChats((prev) =>
          prev.map((t) => (t.id === thread.id ? { ...t, conversation_id: conversationId } : t)),
        );
      });
      return { ok: true, thread };
    },
    [activeChats, agreedProviderId, blockedProviderIds, currentOrder?.id, user?.id],
  );

  const closeChat = useCallback((threadId: string) => {
    setActiveChats((prev) => prev.filter((t) => t.id !== threadId));
  }, []);

  const getThreadByProviderId = useCallback(
    (providerId: string) => activeChats.find((t) => t.provider_id === providerId),
    [activeChats],
  );

  const getProviderById = useCallback(
    (providerId: string) =>
      candidates.find((p) => p.id === providerId) ?? knownProviders.find((p) => p.id === providerId),
    [candidates, knownProviders],
  );

  // كل مقدمي الخدمة المعروفين (مرشحو البحث الحالي + من استُعيدوا من القاعدة)
  const allProviders = useMemo(
    () => [...candidates, ...knownProviders.filter((k) => !candidates.some((c) => c.id === k.id))],
    [candidates, knownProviders],
  );

  // ═══════════════════════════════════════════════════════════
  // Agreement
  // ═══════════════════════════════════════════════════════════
  const customerAgrees = useCallback(
    (
      threadId: string,
      providerId: string,
      customerName: string,
      chatHistory: ChatMessage[],
    ) => {
      clearTimer();
      const agreedPrice = extractPriceFromChat(chatHistory);
      const commission = estimateCommissionFromChat(chatHistory);
      const now = new Date().toISOString();
      const provider = candidates.find((p) => p.id === providerId);

      setAgreedProviderId(providerId);
      setApprovalDeadline(Date.now() + APPROVAL_TIMEOUT_MS);

      setCurrentOrder((prev) =>
        prev
          ? {
              ...prev,
              status: OrderStatus.AWAITING_AGREEMENT,
              provider_id: providerId,
              provider_name: provider?.name ?? null,
              provider_card_color: provider?.card_color ?? null,
              commission_amount: commission,
              agreed_price: agreedPrice,
              updated_at: now,
            }
          : prev,
      );

      const approvalMessage = systemMessage(
        activeChats.find((t) => t.id === threadId)?.order_id ?? '',
        `لقد أكّد ${customerName} أنه اتفق معك لإتمام العمل. قيمة العمولة المتوقعة: ${commission} ل.س. بالموافقة بينخصم المبلغ فوراً وتبلش الخدمة.`,
      );
      approvalMessage.id = `agreement_${threadId}`;

      setActiveChats((prev) =>
        lockUnselectedThreads(prev, providerId, (thread) =>
          systemMessage(thread.order_id, 'ربما يتم الاتفاق مع شخص آخر لإتمام هذه المهمة.'),
        ).map((thread) =>
          thread.id === threadId
            ? { ...thread, last_message: approvalMessage, updated_at: now }
            : { ...thread, updated_at: now },
        ),
      );

      pushNotification({
        type: 'agreement_confirmed',
        title: 'بانتظار موافقة مقدم الخدمة',
        body: `تم إرسال طلب الاتفاق إلى ${provider?.name ?? 'مقدم الخدمة'}. بانتظار موافقته على الاتفاق.`,
        referenceId: providerId,
        route: '/orders/active',
      });

      void syncAgreementToSupabase({
        threadId,
        requestId: activeChats.find((t) => t.id === threadId)?.order_id ?? currentOrder?.id ?? '',
        providerId,
        requesterId: user?.id,
        price: agreedPrice,
        commission,
      });
    },
    [activeChats, candidates, clearTimer, currentOrder, pushNotification, user?.id],
  );

  const providerApproves = useCallback(
    (threadId: string) => {
      clearTimer();
      const now = new Date().toISOString();
      setApprovalDeadline(null);
      setApprovalRemainingSeconds(0);

      setCurrentOrder((prev) =>
        prev ? { ...prev, status: OrderStatus.ACTIVE, updated_at: now } : prev,
      );

      setActiveChats((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, status: ChatStatus.ACTIVE, updated_at: now } : t,
        ),
      );

      pushNotification({
        type: 'agreement_approved',
        title: 'تم قبول الاتفاق!',
        body: 'مقدم الخدمة وافق على الاتفاق. الطلب صار نشطاً.',
        referenceId: threadId,
        route: '/(drawer)/(tabs)/orders',
      });
    },
    [clearTimer, pushNotification],
  );

  const providerRejects = useCallback(
    (threadId: string) => {
      clearTimer();
      const now = new Date().toISOString();
      setAgreedProviderId(null);
      setApprovalDeadline(null);
      setApprovalRemainingSeconds(0);

      setCurrentOrder((prev) => (prev ? { ...resetPendingAgreement(prev), updated_at: now } : prev));

      setActiveChats((prev) =>
        prev.map((t) => {
          if (t.id === threadId) {
            return { ...t, status: ChatStatus.NEGOTIATING, updated_at: now };
          }
          if (t.status === ChatStatus.LOCKED_NOT_CHOSEN) {
            return { ...t, status: ChatStatus.NEGOTIATING, updated_at: now };
          }
          return t;
        }),
      );

      pushNotification({
        type: 'agreement_rejected',
        title: 'تم رفض الاتفاق',
        body: 'مقدم الخدمة رفض الاتفاق. يمكنك التفاوض مع مرشح آخر.',
        referenceId: threadId,
        route: '/(drawer)/(tabs)/orders',
      });
    },
    [clearTimer, pushNotification],
  );

  const customerCancelsAgreement = useCallback(() => {
    clearTimer();
    const now = new Date().toISOString();
    setAgreedProviderId(null);
    setApprovalDeadline(null);
    setApprovalRemainingSeconds(0);

    setCurrentOrder((prev) => (prev ? { ...resetPendingAgreement(prev), updated_at: now } : prev));

    setActiveChats((prev) =>
      prev.map((t) => {
        if (
          t.status === ChatStatus.LOCKED_NOT_CHOSEN ||
          t.status === ChatStatus.AWAITING_APPROVAL
        ) {
          return { ...t, status: ChatStatus.NEGOTIATING, updated_at: now };
        }
        return t;
      }),
    );
  }, [clearTimer]);

  const reportNonExecution = useCallback((dto: CreateNonExecutionReportDto) => {
    const now = new Date().toISOString();
    const isProviderReport = dto.reporter_role === 'provider';
    const nextStatus = isProviderReport
      ? OrderStatus.CANCELLED
      : OrderStatus.NOT_EXECUTED_REVIEW;
    const workflowStatus = isProviderReport ? 'cancelled_no_refund' : 'pending_review';

    setCurrentOrder((prev) => {
      if (!prev || prev.id !== dto.order_id) return prev;
      const updated: Order = {
        ...prev,
        status: nextStatus,
        not_executed_reported_by: dto.reporter_role,
        non_execution_status: workflowStatus,
        updated_at: now,
      };
      setOrderHistory((history) => [updated, ...history.filter((item) => item.id !== updated.id)]);
      return null;
    });
    setActiveChats([]);
    setAgreedProviderId(null);

    if (dto.reporter_role === 'provider') {
      pushNotification({
        type: 'order_cancelled',
        title: 'تم تسجيل عدم تنفيذ الخدمة',
        body: 'تم إلغاء الطلب وفق بلاغ مقدم الخدمة. لا يتم إنشاء استرداد مالي تلقائي من التطبيق.',
        referenceId: dto.order_id,
        route: '/(drawer)/(tabs)/orders',
      });
    } else {
      pushNotification({
        type: 'order_cancelled',
        title: 'تم استلام بلاغ عدم تنفيذ الخدمة',
        body: 'تم تسجيل البلاغ للمراجعة. لا يتم حسم الاسترداد المالي من الواجهة قبل قرار النظام.',
        referenceId: dto.order_id,
        route: '/(drawer)/(tabs)/orders',
      });
    }
  }, [pushNotification]);

  // ═══════════════════════════════════════════════════════════
  // Complete + Rate
  // ═══════════════════════════════════════════════════════════
  const completeOrder = useCallback(() => {
    if (!currentOrder) return;
    const now = new Date().toISOString();

    const pendingRating: Order = {
      ...currentOrder,
      status: OrderStatus.COMPLETION_PENDING_RATING,
      completed_at: now,
      updated_at: now,
      rating_deadline: new Date(Date.now() + RATING_TIMEOUT_MS).toISOString(),
      rating_auto_approved: false,
      rating_reminder_sent: false,
    };

    setOrderHistory((prev) => [pendingRating, ...prev]);
    setCurrentOrder(null);
    setActiveChats([]);
    setAgreedProviderId(null);

    pushNotification({
      type: 'order_completed',
      title: 'تم إنهاء الخدمة',
      body: 'تم تسجيل إكمال الخدمة. لديك مهلة لتقييم مقدم الخدمة قبل اعتماد الطلب نهائياً.',
      referenceId: pendingRating.id,
      route: '/(drawer)/(tabs)/orders',
    });
  }, [currentOrder, pushNotification]);

  const rateOrder = useCallback((dto: RatingDto) => {
    setOrderHistory((prev) =>
      prev.map((o) =>
        o.id === dto.order_id
          ? {
              ...o,
              customer_rating: dto.stars,
              customer_comment: dto.comment ?? null,
              customer_tags: dto.tags ?? [],
              status: OrderStatus.COMPLETED,
              rating_deadline: null,
              rating_auto_approved: false,
              updated_at: new Date().toISOString(),
            }
          : o,
      ),
    );
  }, []);

  useEffect(() => {
    const checkRatingDeadlines = () => {
      const now = Date.now();

      setOrderHistory((prev) => {
        let changed = false;
        const next = prev.map((o) => {
          if (!o.rating_deadline || o.customer_rating) return o;

          const deadlineMs = new Date(o.rating_deadline).getTime();
          const remainingMs = deadlineMs - now;

          if (remainingMs > 0 && remainingMs <= 24 * 60 * 60 * 1000 && !o.rating_reminder_sent) {
            changed = true;
            pushNotification({
              type: 'rating_reminder',
              title: 'ما نسيت تقيّم؟',
              body: 'باقي أقل من 24 ساعة عشان تقيّم آخر طلب قبل ما يُعتمد تلقائياً.',
              referenceId: o.id,
              route: '/(drawer)/(tabs)/orders',
            });
            return { ...o, rating_reminder_sent: true };
          }

          if (remainingMs <= 0 && !o.rating_auto_approved) {
            changed = true;
            pushNotification({
              type: 'rating_auto_approved',
              title: 'تم اعتماد الطلب تلقائياً',
              body: 'انتهت مهلة التقييم بدون تقييم فعلي، فتم اعتماد الطلب تلقائياً كمكتمل.',
              referenceId: o.id,
              route: '/(drawer)/(tabs)/orders',
            });
            return {
              ...o,
              status: OrderStatus.COMPLETED,
              rating_auto_approved: true,
              rating_deadline: null,
              updated_at: new Date().toISOString(),
            };
          }

          return o;
        });

        return changed ? next : prev;
      });
    };

    checkRatingDeadlines();
    const interval = setInterval(checkRatingDeadlines, 30 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFirstSkill = useCallback(
    async (skill: ProviderSkill & { price_min?: number; price_max?: number }): Promise<{ welcomeBonus: boolean; clarificationQuestion?: string }> => {
      const currentProfile = myProviderProfile;
      const isFirstSkill = !currentProfile || currentProfile.skills.length === 0;

      const response = await api.providerServices.create({
        description: skill.description?.trim() || skill.name.trim(),
        experience_years: skill.years_of_experience ?? 0,
        price_min: skill.price_min ?? 0,
        price_max: skill.price_max ?? 0,
        service_area: skill.service_area?.trim() ?? '',
                additional_info: skill.additional_info?.trim() || '',
      });

      if (!response.success) {
        pushNotification({
          type: 'order_cancelled',
          title: 'تعذر إضافة الخدمة',
          body: response.error.message,
          route: '/orders/become-provider',
        });
        return { welcomeBonus: false };
      }

      const row = response.data;
      const savedSkill: ProviderSkill = {
        id: row.id,
        name: skill.name,
        years_of_experience: row.experience_years,
        description: row.description,
        service_area: skill.service_area ?? '',
                additional_info: skill.additional_info,
      };

      setMyProviderProfile((prev) => ({
        skills: [...(prev?.skills ?? []), savedSkill],
        bio: prev?.bio,
        is_available: prev?.is_available ?? true,
        welcome_bonus_received: prev?.welcome_bonus_received ?? false,
      }));

      const alreadyReceived = currentProfile?.welcome_bonus_received ?? false;
      const shouldGiveBonus = isFirstSkill && !alreadyReceived;
      if (shouldGiveBonus) {
        setMyProviderProfile((prev) => (prev ? { ...prev, welcome_bonus_received: true } : prev));
        addTransaction('credit', WELCOME_BONUS_AMOUNT, 'welcome_bonus', 'مكافأة انضمام مقدم خدمة جديد');
        pushNotification({
          type: 'welcome_bonus',
          title: 'مبروك! مكافأة انضمام',
          body: `حصلت على ${WELCOME_BONUS_AMOUNT} ل.س كمكافأة انضمام.`,
          route: '/(drawer)/(tabs)/wallet',
        });
      }
      return { welcomeBonus: shouldGiveBonus };
    },
    [myProviderProfile, addTransaction, pushNotification],
  );

  const updateProviderProfile = useCallback((patch: Partial<MyProviderProfile>) => {
    setMyProviderProfile((prev) => {
      if (!prev) return null;

      if (user?.id && (patch.bio !== undefined || patch.is_available !== undefined)) {
        void supabase
          .from('provider_profiles')
          .update({
            ...(patch.bio !== undefined ? { bio: patch.bio ?? null } : {}),
            ...(patch.is_available !== undefined ? { is_available: patch.is_available } : {}),
          })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) {
              console.error('[Supabase][providerProfile] فشل حفظ تعديل الملف:', error.message);
            }
          });
      }

      return { ...prev, ...patch };
    });
  }, [user?.id]);

  const toggleAvailability = useCallback(() => {
    setMyProviderProfile((prev) => {
      if (!prev) return null;

      const nextAvailable = !prev.is_available;

      if (user?.id) {
        void supabase
          .from('provider_profiles')
          .update({ is_available: nextAvailable })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) {
              console.error('[Supabase][providerProfile] فشل حفظ حالة التوفر:', error.message);
            }
          });
      }

      return { ...prev, is_available: nextAvailable };
    });
  }, [user?.id]);

  const estimateCommission = useCallback(
    (messages: ChatMessage[]) => estimateCommissionFromChat(messages),
    [],
  );

  const getOrderById = useCallback(
    (orderId: string) => orderHistory.find((o) => o.id === orderId),
    [orderHistory],
  );

  const isLowBalance = balance > 0 && balance < LOW_BALANCE_THRESHOLD;
  const isCriticalBalance = balance < CRITICAL_BALANCE_THRESHOLD;
  const isVerified = verificationStatus === 'verified';

  const value = useMemo<OrderContextValue>(
    () => ({
      currentOrder,
      candidates,
      allProviders,
      activeChats,
      agreedProviderId,
      approvalRemainingSeconds,
      orderHistory,
      myProviderProfile,
      hasProviderProfile: !!myProviderProfile && myProviderProfile.skills.length > 0,
      welcomeBonusReceived: myProviderProfile?.welcome_bonus_received ?? false,
      balance,
      transactions,
      isLowBalance,
      isCriticalBalance,
      verificationStatus,
      isVerified,
      verificationRequest,
      reports,
      blockedProviderIds,
      notifications,
      unreadNotificationsCount,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotification,
      clearAllNotifications,
      hasAcceptedDisclaimer,
      acceptDisclaimer,
      startOrder,
      setCandidates,
      resetOrder,
      openChat,
      closeChat,
      getThreadByProviderId,
      getProviderById,
      hasCompletedOrderWith,
      requestProviderAgain,
      customerAgrees,
      providerApproves,
      providerRejects,
      customerCancelsAgreement,
      completeOrder,
      rateOrder,
      addFirstSkill,
      updateProviderProfile,
      toggleAvailability,
      addTransaction,
      topUp,
      submitVerification,
      resetVerification,
      submitReport,
      reportNonExecution,
      blockProvider,
      unblockProvider,
      isProviderBlocked,
      estimateCommission,
      getOrderById,
    }),
    [
      currentOrder,
      candidates,
      allProviders,
      activeChats,
      agreedProviderId,
      approvalRemainingSeconds,
      orderHistory,
      myProviderProfile,
      balance,
      transactions,
      isLowBalance,
      isCriticalBalance,
      verificationStatus,
      isVerified,
      verificationRequest,
      reports,
      blockedProviderIds,
      notifications,
      unreadNotificationsCount,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotification,
      clearAllNotifications,
      hasAcceptedDisclaimer,
      acceptDisclaimer,
      startOrder,
      setCandidates,
      resetOrder,
      openChat,
      closeChat,
      getThreadByProviderId,
      getProviderById,
      hasCompletedOrderWith,
      requestProviderAgain,
      customerAgrees,
      providerApproves,
      providerRejects,
      customerCancelsAgreement,
      completeOrder,
      rateOrder,
      addFirstSkill,
      updateProviderProfile,
      toggleAvailability,
      addTransaction,
      topUp,
      submitVerification,
      resetVerification,
      submitReport,
      reportNonExecution,
      blockProvider,
      unblockProvider,
      isProviderBlocked,
      estimateCommission,
      getOrderById,
    ],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) {
    throw new Error('useOrder must be used within an <OrderProvider>');
  }
  return ctx;
}