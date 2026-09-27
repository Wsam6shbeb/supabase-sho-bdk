// ===============================================================
// شرح الملف: هذا ملف من طبقة الاتصال بالـ Backend/API (contracts).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: reportNonExecution.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import type {
  AuthResult,
  ForgotPasswordDto,
  ForgotPasswordResult,
  LoginDto,
  RegisterDto,
  User,
} from '@/types/auth';
import type { CreateOrderDto, Order, RatingDto, ServiceProvider } from '@/types/orders';
import type { CreateNonExecutionReportDto, CreateReportDto, Report } from '@/types/reports';
import type { VerificationRequest } from '@/types/wallet';

/**
 * Frontend/Backend contract.
 *
 * The mobile app talks to these interfaces only. Database tables, SQL,
 * provider implementation details and internal backend services must never
 * leak into the UI layer.
 */
export interface ApiError {
  code: string;
  message: string;
  field?: string;
  request_id?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total?: number;
  next_cursor?: string | null;
}

export interface AgreementSnapshotDto {
  id: string;
  request_id: string;
  provider_id: string;
  price: number;
  commission: number;
  currency: string;
  status: 'PENDING_PROVIDER' | 'ACTIVE' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  created_at: string;
  provider_approval_deadline: string;
}

export interface ConversationDto {
  id: string;
  request_id: string;
  provider_id: string;
  status: 'NEGOTIATING' | 'PENDING_PROVIDER' | 'ACTIVE' | 'LOCKED';
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface MessageDto {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_system: boolean;
  created_at: string;
  read_at?: string | null;
}

export interface WalletSummaryDto {
  balance: number;
  currency: string;
  is_low_balance: boolean;
}

export interface WalletLedgerEntryDto {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  reason: string;
  description: string;
  order_id?: string | null;
  created_at: string;
}

export interface AuthApi {
  login(input: LoginDto): Promise<AuthResult>;
  register(input: RegisterDto): Promise<AuthResult>;
  forgotPassword(input: ForgotPasswordDto): Promise<ForgotPasswordResult>;
  getCurrentUser(): Promise<User>;
  logout(): Promise<void>;
}

export interface RequestsApi {
  create(input: CreateOrderDto & { region_id: string }): Promise<Order>;
  getById(id: string): Promise<Order>;
  list(params?: { cursor?: string; limit?: number }): Promise<PaginatedResponse<Order>>;
  getCandidates(id: string): Promise<ServiceProvider[]>;
}

export interface ConversationsApi {
  list(requestId?: string): Promise<PaginatedResponse<ConversationDto>>;
  create(requestId: string, providerId: string): Promise<ConversationDto>;
  getMessages(conversationId: string, params?: { cursor?: string; limit?: number }): Promise<PaginatedResponse<MessageDto>>;
  sendMessage(conversationId: string, content: string, idempotencyKey: string): Promise<MessageDto>;
}

export interface AgreementsApi {
  confirm(input: {
    requestId: string;
    conversationId: string;
    providerId: string;
    phoneSharing?: boolean;
    idempotencyKey: string;
  }): Promise<AgreementSnapshotDto>;
  approve(agreementId: string, idempotencyKey: string): Promise<AgreementSnapshotDto>;
  reject(agreementId: string, idempotencyKey: string): Promise<AgreementSnapshotDto>;
  cancel(agreementId: string, idempotencyKey: string): Promise<AgreementSnapshotDto>;
}

export interface WalletApi {
  getSummary(): Promise<WalletSummaryDto>;
  getLedger(params?: { cursor?: string; limit?: number }): Promise<PaginatedResponse<WalletLedgerEntryDto>>;
}

export interface RatingsApi {
  create(input: RatingDto, idempotencyKey: string): Promise<void>;
}

export interface VerificationApi {
  getCurrent(): Promise<VerificationRequest | null>;
  submit(input: { id_photo_uri: string; selfie_uri: string }): Promise<VerificationRequest>;
}

export interface ReportsApi {
  create(input: CreateReportDto, idempotencyKey: string): Promise<Report>;
// [شرح الدالة: reportNonExecution] تنفذ الدالة «reportNonExecution» المهمة البرمجية المرتبطة بهذا الملف وتعيد النتيجة التي يعتمد عليها باقي الكود.
  reportNonExecution(input: CreateNonExecutionReportDto, idempotencyKey: string): Promise<{ status: 'pending_review' | 'cancelled_no_refund' | 'refund_pending' | 'admin_review' }>;
}

export interface BlocksApi {
  list(): Promise<string[]>;
  create(providerId: string, idempotencyKey: string): Promise<void>;
  remove(providerId: string, idempotencyKey: string): Promise<void>;
}

export interface NotificationsApi {
  list(params?: { cursor?: string; limit?: number }): Promise<PaginatedResponse<unknown>>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

export interface FrontendApiContract {
  auth: AuthApi;
  requests: RequestsApi;
  conversations: ConversationsApi;
  agreements: AgreementsApi;
  wallet: WalletApi;
  ratings: RatingsApi;
  verification: VerificationApi;
  reports: ReportsApi;
  blocks: BlocksApi;
  notifications: NotificationsApi;
}
