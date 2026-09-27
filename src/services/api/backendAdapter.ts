// ===============================================================
// شرح الملف: هذا ملف من طبقة الاتصال بالـ Backend/API (backendAdapter).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: trim، mapUser، normalizeError، createBackendApi، authResult، login، google، register، verifyEmail، resendOtp، refresh، forgotPassword، resetPassword، changePassword، getCurrentUser، getSummary، getTransactions، mine.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import type {
  AuthResult,
  ForgotPasswordDto,
  ForgotPasswordResult,
  GoogleLoginDto,
  LoginDto,
  PasswordChangeDto,
  PasswordChangeResult,
  PasswordResetDto,
  PasswordResetResult,
  RegisterDto,
  RegisterResult,
  ResendOtpDto,
  ResendOtpResult,
  User,
  VerifyEmailDto,
  VerifyEmailResult,
} from '@/types/auth';
import type { ApiResponse } from '@/types/common';
import type { Transaction } from '@/types/wallet';
import * as SecureStore from 'expo-secure-store';

// [شرح الدالة: trim] ينظف عنوان الـ URL الأساسي من الشرطة المائلة الزائدة في النهاية.
const trim = (v: string) => v.replace(/\/$/, '');
export const SYRIAN_REGIONS = [
  { id: 'دمشق', name_ar: 'دمشق' },
  { id: 'حلب', name_ar: 'حلب' },
  { id: 'حمص', name_ar: 'حمص' },
  { id: 'حماه', name_ar: 'حماه' },
  { id: 'اللاذقية', name_ar: 'اللاذقية' },
  { id: 'طرطوس', name_ar: 'طرطوس' },
  { id: 'إدلب', name_ar: 'إدلب' },
  { id: 'درعا', name_ar: 'درعا' },
  { id: 'السويداء', name_ar: 'السويداء' },
  { id: 'القنيطرة', name_ar: 'القنيطرة' },
  { id: 'دير الزور', name_ar: 'دير الزور' },
  { id: 'الرقة', name_ar: 'الرقة' },
  { id: 'الحسكة', name_ar: 'الحسكة' },
];


// [شرح الدالة: mapUser] يحوّل بيانات المستخدم القادمة من الـ Backend إلى الشكل الذي يستخدمه التطبيق.
function mapUser(raw: any): User {
  const regionValue = raw?.region;
  const regionId = typeof regionValue === 'object' ? String(regionValue?.id ?? '') : String(regionValue ?? '');
  const regionName = typeof regionValue === 'object'
    ? String(regionValue?.name_ar ?? regionValue?.name ?? '')
    : String(regionValue ?? '');

  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? ''),
    email: String(raw?.email ?? ''),
    phone: String(raw?.phone ?? ''),
    region: { id: regionId, name_ar: regionName },
    avatar_url: raw?.image ?? raw?.avatar_url ?? null,
    has_provider_profile: Boolean(raw?.is_provider ?? raw?.has_provider_profile ?? false),
    provider_profile: raw?.provider_profile ?? null,
    verification_status: raw?.is_verified ? 'verified' : 'not_verified',
    balance: Number(raw?.balance ?? 0),
    received_welcome_bonus: Boolean(raw?.received_welcome_bonus ?? false),
    created_at: String(raw?.created_at ?? new Date().toISOString()),
  };
}

// [شرح الدالة: normalizeError] يوحّد أخطاء الـ Backend في شكل واحد يمكن للواجهة التعامل معه.
function normalizeError(status: number, payload: any): { code: string; message: string } {
  const code = String(payload?.code ?? payload?.error?.code ?? `HTTP_${status}`);
  let message = payload?.detail ?? payload?.error?.message ?? payload?.message;
  if (!message && typeof payload === 'object') {
    const first = Object.values(payload).find((v) => Array.isArray(v) && v.length);
    if (Array.isArray(first)) message = String(first[0]);
  }
  return { code, message: String(message ?? 'تعذر تنفيذ الطلب. حاول مرة أخرى.') };
}

// [شرح الدالة: createBackendApi] ينشئ طبقة API التي تتولى إرسال الطلبات إلى الـ Backend وإرجاع نتائج موحدة.
export function createBackendApi(baseUrl: string) {
  const root = trim(baseUrl);

  async function request<T>(path: string, init: RequestInit = {}, headers?: Record<string,string>): Promise<ApiResponse<T>> {
    try {
      const h = new Headers(init.headers);
      h.set('Accept', 'application/json');
      if (init.body && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
      const access = await SecureStore.getItemAsync('@shobdk/auth_access');
      if (access) h.set('Authorization', `Bearer ${access}`);
      if (headers) Object.entries(headers).forEach(([k, v]) => h.set(k, v));
      const response = await fetch(`${root}${path}`, { ...init, headers: h });
      const raw = await response.text();
      let payload: any = null;
      if (raw) {
        try { payload = JSON.parse(raw); } catch { payload = null; }
      }
      if (!response.ok) return { success: false, error: normalizeError(response.status, payload) };
      return { success: true, data: payload as T };
    } catch {
      return { success: false, error: { code: 'NETWORK_ERROR', message: 'تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.' } };
    }
  }

// [شرح الدالة: authResult] يحوّل استجابة المصادقة الخام إلى AuthResult بالشكل المتوقع داخل التطبيق.
  function authResult(raw: any): AuthResult {
    return {
      access: String(raw?.access ?? ''),
      refresh: String(raw?.refresh ?? ''),
      user: mapUser(raw?.user ?? {}),
      needs_profile: Boolean(raw?.needs_profile),
      is_new_user: Boolean(raw?.is_new_user),
    };
  }

  const auth = {
// [شرح الدالة: login] ينفذ عملية تسجيل الدخول عبر طبقة المصادقة الحالية.
    async login(input: LoginDto): Promise<ApiResponse<AuthResult>> {
      const r = await request<any>('/api/auth/login/', { method: 'POST', body: JSON.stringify(input) });
      return r.success ? { success: true, data: authResult(r.data) } : r;
    },
// [شرح الدالة: google] ينفذ تسجيل الدخول عبر Google من خلال الـ API.
    async google(input: GoogleLoginDto): Promise<ApiResponse<AuthResult>> {
      const r = await request<any>('/api/auth/google/', { method: 'POST', body: JSON.stringify(input) });
      return r.success ? { success: true, data: authResult(r.data) } : r;
    },
// [شرح الدالة: register] ينفذ عملية إنشاء حساب مستخدم جديد.
    async register(input: RegisterDto): Promise<ApiResponse<RegisterResult>> {
      // The documented backend accepts exactly these registration fields.
      return request<RegisterResult>('/api/auth/register/', {
        method: 'POST',
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          name: input.name,
          phone: input.phone,
          region: input.region_id,
        }),
      });
    },
// [شرح الدالة: verifyEmail] يتحقق من رمز/بيانات تأكيد البريد الإلكتروني.
    async verifyEmail(input: VerifyEmailDto): Promise<ApiResponse<VerifyEmailResult>> {
      const r = await request<any>('/api/auth/verify-email/', { method: 'POST', body: JSON.stringify(input) });
      return r.success ? { success: true, data: authResult(r.data) } : r;
    },
// [شرح الدالة: resendOtp] يعيد إرسال رمز التحقق للمستخدم.
    async resendOtp(input: ResendOtpDto): Promise<ApiResponse<ResendOtpResult>> {
      return request<ResendOtpResult>('/api/auth/resend-otp/', { method: 'POST', body: JSON.stringify(input) });
    },
// [شرح الدالة: refresh] يطلب رمز جلسة/وصول جديد اعتمادًا على رمز التحديث.
    async refresh(refresh: string): Promise<ApiResponse<{ access: string }>> {
      return request<{ access: string }>('/api/auth/token/refresh/', { method: 'POST', body: JSON.stringify({ refresh }) });
    },
// [شرح الدالة: forgotPassword] يبدأ عملية استعادة كلمة المرور للمستخدم.
    async forgotPassword(input: ForgotPasswordDto): Promise<ApiResponse<ForgotPasswordResult>> {
      return request<ForgotPasswordResult>('/api/auth/password/forgot/', { method: 'POST', body: JSON.stringify(input) });
    },
// [شرح الدالة: resetPassword] ينفذ تغيير كلمة المرور باستخدام بيانات إعادة التعيين.
    async resetPassword(input: PasswordResetDto): Promise<ApiResponse<PasswordResetResult>> {
      return request<PasswordResetResult>('/api/auth/password/reset/', { method: 'POST', body: JSON.stringify(input) });
    },
// [شرح الدالة: changePassword] ينفذ تغيير كلمة مرور المستخدم الحالي.
    async changePassword(input: PasswordChangeDto): Promise<ApiResponse<PasswordChangeResult>> {
      return request<PasswordChangeResult>('/api/auth/password/change/', { method: 'POST', body: JSON.stringify(input) });
    },
// [شرح الدالة: getCurrentUser] يجلب بيانات المستخدم الحالي من الـ Backend.
    async getCurrentUser(): Promise<ApiResponse<User>> {
      const r = await request<any>('/api/auth/me/');
      return r.success ? { success: true, data: mapUser(r.data) } : r;
    },
    async updateProfile(patch: { name?: string; region?: string; phone?: string }): Promise<ApiResponse<User>> {
      const r = await request<any>('/api/auth/me/', { method: 'PATCH', body: JSON.stringify(patch) });
      return r.success ? { success: true, data: mapUser(r.data) } : r;
    },
  };

  const wallet = {
// [شرح الدالة: getSummary] يجلب ملخص البيانات المرتبط بالمستخدم أو الخدمة.
    async getSummary(): Promise<ApiResponse<{ balance: number; alert_level: 'red'|'yellow'|null; updated_at: string }>> {
      return request('/wallet/api/');
    },
// [شرح الدالة: getTransactions] يجلب حركات المحفظة/المعاملات المالية.
    async getTransactions(): Promise<ApiResponse<Transaction[]>> {
      const r = await request<any[]>('/wallet/api/transactions/');
      if (!r.success) return r;
      return {
        success: true,
        data: r.data.map((x: any) => ({
          id: String(x.id),
          user_id: '',
          type: Number(x.amount) >= 0 ? 'credit' : 'debit',
          amount: Math.abs(Number(x.amount)),
          balance_after: Number(x.balance_after),
          reason: x.transaction_type,
          description: String(x.description ?? ''),
          order_id: x.contact_request == null ? null : String(x.contact_request),
          counterparty_name: x.other_party ?? null,
          created_at: String(x.created_at),
        })),
      };
    },
  };

  const providerServices = {
    async create(input: { description: string; experience_years: number; price_min: number; price_max: number }) {
      return request<any>('/services/api/provider-services/', { method: 'POST', body: JSON.stringify(input) });
    },
// [شرح الدالة: mine] يجلب أو ينشئ بيانات المستخدم الحالية المتعلقة بالطلبات/الخدمة.
    async mine() {
      return request<any[]>('/services/api/provider-services/mine/');
    },
  };

  return { auth, wallet, providerServices };
}
