// ===============================================================
// تصنيف الأخطاء ورسائلها للمستخدم (عربية فصحى، هادئة، بلا تفاصيل تقنية).
//
// - classifyError: يحدد نوع الخطأ من شكله (Supabase/Edge Functions/PostgREST/الشبكة).
// - getUserMessage: رسالة مناسبة للنوع والسياق. لا تتضمن أبداً نص الخطأ الأصلي.
// - الأخطاء المعروفة بأكوادها (INVALID_STATE...) تبقى لدوال الترجمة الخاصة بكل جزء،
//   وتستدعي هذا الملف للحالات غير المعروفة فقط.
// ===============================================================

import { isConnectionError } from '@/services/networkStatus';

export type ErrorKind =
  | 'network'
  | 'timeout'
  | 'server'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'incomplete'
  | 'unexpected';

export type ErrorContext =
  | 'generic'
  | 'load'
  | 'analyzeRequest'
  | 'createOrder'
  | 'sendMessage'
  | 'upload'
  | 'login';

const MESSAGES: Record<ErrorKind, string> = {
  network: 'تعذر الاتصال بالإنترنت. تحقق من اتصالك وحاول مرة أخرى.',
  timeout: 'استغرقت العملية وقتاً أطول من المعتاد. حاول مرة أخرى.',
  server: 'تعذر إكمال العملية بسبب مشكلة مؤقتة في الخدمة. حاول مرة أخرى بعد قليل.',
  auth: 'انتهت جلسة الدخول. يرجى تسجيل الدخول مجدداً.',
  permission: 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
  validation: 'يرجى التحقق من البيانات المُدخلة وحاول مرة أخرى.',
  incomplete: 'لم تكتمل العملية. يمكنك المحاولة مرة أخرى.',
  unexpected: 'حدثت مشكلة غير متوقعة. يرجى المحاولة مجدداً.',
};

const PROCESSING = 'واجهنا مشكلة أثناء معالجة طلبك. يمكنك المحاولة مرة أخرى.';
const LOADING = 'لم نتمكن من تحميل البيانات حالياً.';
const SENDING = 'لم نتمكن من إرسال الرسالة. حاول مرة أخرى.';
const UPLOADING = 'تعذر رفع الصورة. حاول مرة أخرى.';

/** تخصيصات بحسب السياق. الاتصال (network) يبقى برسالته العامة دائماً لأنها الأدق. */
const CONTEXT_MESSAGES: Partial<Record<ErrorContext, Partial<Record<ErrorKind, string>>>> = {
  load: { server: LOADING, timeout: LOADING, incomplete: LOADING, unexpected: LOADING },
  analyzeRequest: { server: PROCESSING, timeout: PROCESSING, incomplete: PROCESSING, unexpected: PROCESSING },
  createOrder: { server: PROCESSING, timeout: PROCESSING, unexpected: PROCESSING },
  sendMessage: { server: SENDING, timeout: SENDING, incomplete: SENDING, unexpected: SENDING },
  upload: { server: UPLOADING, timeout: UPLOADING, incomplete: UPLOADING, unexpected: UPLOADING },
  login: { auth: 'تعذر تسجيل الدخول. تحقق من بياناتك وحاول مرة أخرى.' },
};

export function isRetryableKind(kind: ErrorKind): boolean {
  return kind !== 'auth' && kind !== 'permission' && kind !== 'validation';
}

/** خطأ رسالته جاهزة للعرض للمستخدم (تُرمى من الطبقات الدنيا بدل رسائل تقنية). */
export class UserFacingError extends Error {
  readonly kind: ErrorKind;
  readonly retryable: boolean;

  constructor(message: string, kind: ErrorKind = 'unexpected', retryable: boolean = isRetryableKind(kind)) {
    super(message);
    this.name = 'UserFacingError';
    this.kind = kind;
    this.retryable = retryable;
    Object.setPrototypeOf(this, UserFacingError.prototype);
  }
}

interface ErrorShape {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  context?: unknown;
}

function textOf(error: unknown): string {
  if (typeof error === 'string') return error;
  const message = (error as ErrorShape | null)?.message;
  return typeof message === 'string' ? message : '';
}

function statusOf(error: unknown): number | undefined {
  const e = error as ErrorShape | null;
  const direct = e?.status ?? e?.statusCode;
  if (typeof direct === 'number') return direct;
  const fromContext = (e?.context as { status?: unknown } | undefined)?.status;
  return typeof fromContext === 'number' ? fromContext : undefined;
}

function codeOf(error: unknown): string | undefined {
  const code = (error as ErrorShape | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

function nameOf(error: unknown): string {
  const name = (error as ErrorShape | null)?.name;
  return typeof name === 'string' ? name : '';
}

function isTimeout(text: string, status: number | undefined): boolean {
  return (
    status === 408 ||
    status === 504 ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('etimedout')
  );
}

export function classifyError(error: unknown): ErrorKind {
  if (error instanceof UserFacingError) return error.kind;

  const name = nameOf(error);
  const text = textOf(error).toLowerCase();
  const status = statusOf(error);
  const code = codeOf(error);

  // Edge Functions
  if (name === 'FunctionsFetchError' || name === 'FunctionsRelayError') return 'server';
  if (name === 'FunctionsHttpError') {
    if (status === 401) return 'auth';
    if (status === 403) return 'permission';
    if (status === 408 || status === 504) return 'timeout';
    if (status === 400 || status === 422) return 'validation';
    return 'server';
  }

  if (isTimeout(text, status)) return 'timeout';
  if (isConnectionError(error)) return 'network';
  if (name === 'AuthRetryableFetchError') return 'network';

  // الدخول والجلسة
  if (
    status === 401 ||
    code === '28000' ||
    code === 'PGRST301' ||
    code === 'PGRST302' ||
    text.includes('jwt') ||
    text.includes('not_authenticated') ||
    text.includes('not authenticated') ||
    text.includes('invalid login credentials') ||
    text.includes('refresh token')
  ) {
    return 'auth';
  }

  // الصلاحيات (RLS وغيرها)
  if (
    status === 403 ||
    code === '42501' ||
    text.includes('row-level security') ||
    text.includes('permission denied') ||
    text.includes('forbidden')
  ) {
    return 'permission';
  }

  // قواعد العمل والتحقق (RAISE EXCEPTION وقيود قاعدة البيانات)
  if (
    status === 400 ||
    status === 422 ||
    code === 'P0001' ||
    code === '23505' ||
    code === '23514' ||
    code === '23502' ||
    code === '23503' ||
    code === '22P02'
  ) {
    return 'validation';
  }

  // الخادم
  if ((status !== undefined && status >= 500) || (code?.startsWith('PGRST') ?? false) || code?.startsWith('XX') || text.includes('internal server error')) {
    return 'server';
  }

  return 'unexpected';
}

export function getUserMessage(error: unknown, context: ErrorContext = 'generic'): string {
  if (error instanceof UserFacingError) return error.message;
  const kind = classifyError(error);
  return CONTEXT_MESSAGES[context]?.[kind] ?? MESSAGES[kind];
}

export interface ErrorInfo {
  kind: ErrorKind;
  message: string;
  retryable: boolean;
}

export function describeError(error: unknown, context: ErrorContext = 'generic'): ErrorInfo {
  if (error instanceof UserFacingError) {
    return { kind: error.kind, message: error.message, retryable: error.retryable };
  }
  const kind = classifyError(error);
  return { kind, message: getUserMessage(error, context), retryable: isRetryableKind(kind) };
}

export function toUserFacingError(error: unknown, context: ErrorContext = 'generic'): UserFacingError {
  if (error instanceof UserFacingError) return error;
  const info = describeError(error, context);
  return new UserFacingError(info.message, info.kind, info.retryable);
}
