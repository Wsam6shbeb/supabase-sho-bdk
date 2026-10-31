// ===============================================================
// شرح الملف: هذا تعريفات الأنواع TypeScript (auth).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import type { Region, VerificationStatus } from './common';

export interface ProviderProfilePlaceholder {
  registered_at?: string;
  [key: string]: unknown;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  region: Region;
  avatar_url?: string | null;
  has_provider_profile: boolean;
  provider_profile?: ProviderProfilePlaceholder | null;
  verification_status: VerificationStatus;
  /** أدمن: يراجع البلاغات ويقرر رد العمولة (يُحدَّد من قاعدة البيانات فقط). */
  is_admin?: boolean;
  /** Account state managed by the admin dashboard. */
  status?: 'active' | 'suspended' | 'deleted';
  balance: number;
  topup_code?: string;
  received_welcome_bonus: boolean;
  created_at: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  phone: string;
  region_id: string;
  avatar_base64?: string | null;
}

export interface RegisterResult {
  email: string;
  resend_after_seconds: number;
}

export interface VerifyEmailDto {
  email: string;
  code: string;
}

export interface ResendOtpDto {
  email: string;
}

export interface PasswordResetDto {
  email: string;
  code: string;
  new_password: string;
}

export interface PasswordChangeDto {
  old_password: string;
  new_password: string;
}

export interface GoogleLoginDto {
  id_token: string;
}

export interface AuthResult {
  access: string;
  refresh: string;
  user: User;
  needs_profile?: boolean;
  is_new_user?: boolean;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ForgotPasswordResult {
  detail: string;
  resend_after_seconds?: number;
}

export interface ResendOtpResult {
  detail: string;
  resend_after_seconds?: number;
}

export interface VerifyEmailResult extends AuthResult {}
export interface PasswordResetResult { detail: string; }
export interface PasswordChangeResult { detail: string; }
