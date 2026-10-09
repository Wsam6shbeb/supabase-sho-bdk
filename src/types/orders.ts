// ===============================================================
// شرح الملف: هذا صفحة الطلبات.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import type { Region } from './common';
import { OrderStatus, ChatStatus } from './common';

// ═══════════════════════════════════════════════════════════
// أنواع الطلبات ومقدمي الخدمة
// ═══════════════════════════════════════════════════════════

/** معلومات مقدم الخدمة */
/** معلومات خدمة واحدة يقدمها المزوّد (من provider_services.structured_data). */
export interface ProviderServiceInfo {
  service: string;
  skills: string[];
  service_area?: string;
  additional_info?: string;
  delivery_mode?: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  avatar_url?: string | null;
  region: Region;
  skills: string[];
  /** تفاصيل الخدمات: المنطقة والمعلومات الاختيارية وطريقة التقديم. */
  services?: ProviderServiceInfo[];
  rating: number;
  total_orders: number;
  completion_rate: number;
  response_time_minutes: number;
  cancellation_rate: number;
  balance: number;
  is_available: boolean;
  verification_status: 'not_verified' | 'under_review' | 'verified';
  card_color: string;
  /** معرّف طلب الخدمة (service_requests.id) الذي ظهر هذا المزوّد كمرشح له. */
  service_request_id?: string;
  /** درجة المطابقة المبدئية المحسوبة من structured_data. */
  match_score?: number;
  /** صحيح عندما تكون النتيجة بديلاً محلياً لأن المطابقة القوية لم تُنتج نتائج. */
  is_fallback_match?: boolean;
  /** سبب مختصر لاقتراح مقدم الخدمة أو كونه بديلاً. */
  match_reason?: string;
}

/** بيانات إنشاء طلب جديد */
export interface CreateOrderDto {
  description: string;
  is_urgent: boolean;
}

/** معلومات الطلب */
export interface Order {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  /** الطرف الحالي بالنسبة للطلب. */
  my_role?: 'customer' | 'provider';
  description: string;
  is_urgent: boolean;
  status: OrderStatus;
  region_id: string;
  created_at: string;
  updated_at: string;
  provider_id?: string | null;
  provider_name?: string | null;
  provider_card_color?: string | null;
  commission_amount?: number | null;
  agreed_price?: number | null;
  // ⭐ التقييم
  customer_rating?: number | null;
  customer_comment?: string | null;
  customer_tags?: string[];
  provider_rating?: number | null;
  provider_comment?: string | null;
  completed_at?: string | null;
  // ⭐ الاعتماد التلقائي إذا ما قيّم الزبون خلال المهلة
  rating_deadline?: string | null;
  rating_auto_approved?: boolean;
  rating_reminder_sent?: boolean;
  /** Non-execution / dispute state; financial settlement remains server-authoritative. */
  not_executed_reported_by?: 'customer' | 'provider' | 'both' | null;
  non_execution_status?: 'none' | 'pending_review' | 'cancelled_no_refund' | 'refund_pending' | 'admin_review' | null;
}

/** رسالة محادثة */
export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_system: boolean;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
  /** حالة الرسالة التي أرسلتها أنا: جاري الإرسال، أُرسلت، وصلت، قُرئت، فشلت. */
  status?: MessageStatus;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/** موضوع محادثة مع مقدم خدمة */
export interface ChatThread {
  id: string;
  /** معرّف المحادثة الحقيقي في Supabase (conversations.id) بعد فتحها. */
  conversation_id?: string | null;
  order_id: string;
  provider_id: string;
  customer_id: string;
  status: ChatStatus;
  last_message?: ChatMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

/** لون بطاقة مقدم الخدمة */
export interface ProviderCardColor {
  id: string;
  name: string;
  color: string;
  color_light: string;
}

// ⭐ التقييم
/** بيانات التقييم */
export interface RatingDto {
  order_id: string;
  stars: number; // 1-5
  comment?: string;
  tags?: string[];
}

// ⭐ المهام المكتملة (للتقييم)
/** طلب مكتمل مع إمكانيات التقييم */
export interface CompletedOrder extends Order {
  can_rate: boolean;
  can_chat: boolean;
  can_request_again: boolean;
}