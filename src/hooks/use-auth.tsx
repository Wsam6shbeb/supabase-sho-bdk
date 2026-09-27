// ===============================================================
// useAuth — Supabase Auth مباشرة
// ===============================================================

import { supabase } from '@/services/supabase';
import type {
  AuthResult,
  ForgotPasswordDto,
  ForgotPasswordResult,
  LoginDto,
  RegisterDto,
  RegisterResult,
  User,
  VerifyEmailDto,
  ResendOtpDto,
  ResendOtpResult,
  PasswordResetDto,
  PasswordResetResult,
  GoogleLoginDto,
} from '@/types/auth';
import type { ApiError, Region } from '@/types/common';
import { VerificationStatus } from '@/types/common';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface AuthState {
  user: User | null;
  token: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  lastError: ApiError | null;
}

export interface UseAuth extends AuthState {
  login: (dto: LoginDto) => Promise<AuthResult | null>;
  loginWithGoogle: (dto: GoogleLoginDto) => Promise<AuthResult | null>;
  register: (dto: RegisterDto) => Promise<RegisterResult | null>;
  verifyEmail: (dto: VerifyEmailDto) => Promise<AuthResult | null>;
  resendOtp: (dto: ResendOtpDto) => Promise<ResendOtpResult | null>;
  forgotPassword: (dto: ForgotPasswordDto) => Promise<ForgotPasswordResult | null>;
  resetPassword: (dto: PasswordResetDto) => Promise<PasswordResetResult | null>;
  logout: () => Promise<boolean>;
  clearError: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isInitialized: false,
  isLoading: false,
  lastError: null,
};

const AuthContext = createContext<UseAuth | null>(null);

// تحويل مستخدم Supabase لشكل User تبعنا
function mapSupabaseUser(sbUser: any): User {
  const meta = sbUser.user_metadata ?? {};
  const region: Region = meta.region
    ? { id: meta.region.id ?? '', name_ar: meta.region.name_ar ?? meta.region ?? '' }
    : { id: '', name_ar: meta.region ?? '' };

  return {
    id: sbUser.id,
    name: meta.full_name ?? meta.name ?? '',
    email: sbUser.email ?? '',
    phone: sbUser.phone ?? meta.phone ?? '',
    region: region,
    avatar_url: meta.avatar_url ?? null,
    has_provider_profile: meta.has_provider_profile ?? false,
    provider_profile: null,
    verification_status: (meta.verification_status ?? VerificationStatus.NOT_VERIFIED) as VerificationStatus,
    balance: 0,
    received_welcome_bonus: false,
    created_at: sbUser.created_at ?? new Date().toISOString(),
  };
}

function mapError(err: any): ApiError {
  return {
    code: err?.code ?? 'UNKNOWN',
    message: err?.message ?? 'حدث خطأ غير متوقع',
  };
}

// يضمن وجود صف بجدول public.users لهذا المستخدم (لا يلمس صفاً موجوداً مسبقاً).
// ضروري لأنو trigger إنشاء المحفظة (trg_create_wallet_for_new_user) مرتبط
// بـ INSERT على public.users، وليس على auth.users مباشرة.
async function ensureUserProfile(sbUser: any) {
  try {
    const meta = sbUser?.user_metadata ?? {};
    const { error } = await supabase.from('users').upsert(
      {
        id: sbUser.id,
        full_name: meta.full_name ?? meta.name ?? '',
        phone: sbUser.phone || meta.phone || null,
        region: meta.region_id ?? meta.region ?? null,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) {
      console.error('[Supabase][ensureUserProfile] فشل إنشاء صف المستخدم:', error.message);
    }
  } catch (err) {
    console.error('[Supabase][ensureUserProfile] خطأ غير متوقع أثناء إنشاء صف المستخدم:', err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  // مراقبة حالة الجلسة
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (data.session?.user) {
          setState((p) => ({
            ...p,
            user: mapSupabaseUser(data.session!.user),
            token: data.session!.access_token,
            isInitialized: true,
            lastError: null,
          }));
          void ensureUserProfile(data.session.user);
        } else {
          setState((p) => ({ ...p, isInitialized: true }));
        }
      } catch {
        if (!cancelled) setState((p) => ({ ...p, isInitialized: true }));
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        setState((p) => ({
          ...p,
          user: mapSupabaseUser(session.user),
          token: session.access_token,
          isInitialized: true,
          lastError: null,
        }));
        void ensureUserProfile(session.user);
      } else {
        setState((p) => ({
          ...p,
          user: null,
          token: null,
          isInitialized: true,
        }));
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const clearError = useCallback(() => setState((p) => ({ ...p, lastError: null })), []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setState((p) => (p.user ? { ...p, user: { ...p.user, ...patch } } : p));
  }, []);

  // تسجيل الدخول
  const login = useCallback(async (dto: LoginDto) => {
    setState((p) => ({ ...p, isLoading: true, lastError: null }));
    const { data, error } = await supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      const apiErr = mapError(error);
      setState((p) => ({ ...p, isLoading: false, lastError: apiErr }));
      return null;
    }

    const user = mapSupabaseUser(data.user);
    setState((p) => ({
      ...p,
      user,
      token: data.session?.access_token ?? null,
      isLoading: false,
      lastError: null,
    }));
    return { user, access: data.session?.access_token ?? '', refresh: data.session?.refresh_token ?? '' } as AuthResult;
  }, []);

  // Google (مؤجل — سنستخدم Supabase OAuth لاحقاً)
  const loginWithGoogle = useCallback(async (_dto: GoogleLoginDto) => {
    const error = { code: 'GOOGLE_NOT_CONFIGURED', message: 'تسجيل الدخول عبر Google سيتم تفعيله لاحقاً.' };
    setState((p) => ({ ...p, lastError: error }));
    return null;
  }, []);

  // تسجيل حساب جديد
  const register = useCallback(async (dto: RegisterDto) => {
    setState((p) => ({ ...p, isLoading: true, lastError: null }));
     const { data, error } = await supabase.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        data: {
          full_name: dto.name,
          phone: dto.phone,
          region_id: dto.region_id,
        },
      },
    });

    if (error) {
      const apiErr = mapError(error);
      setState((p) => ({ ...p, isLoading: false, lastError: apiErr }));
      return null;
    }

    if (data.user) {
      void ensureUserProfile(data.user);
    }

     setState((p) => ({ ...p, isLoading: false, lastError: null }));
    return {
      email: dto.email,
      resend_after_seconds: 60,
    } as RegisterResult;
  }, []); 
  // verify email (مؤجل — Supabase ما بدها إلا إذا فعّلناها)
  const verifyEmail = useCallback(async (_dto: VerifyEmailDto) => {
    const error = { code: 'NOT_NEEDED', message: 'التحقق من الإيميل غير مفعّل حالياً.' };
    setState((p) => ({ ...p, lastError: error }));
    return null;
  }, []);

  // resend OTP (مؤجل)
  const resendOtp = useCallback(async (_dto: ResendOtpDto) => {
    const error = { code: 'NOT_NEEDED', message: 'إعادة إرسال OTP غير مفعّلة حالياً.' };
    setState((p) => ({ ...p, lastError: error }));
    return null;
  }, []);

  // نسيت كلمة السر
  const forgotPassword = useCallback(async (dto: ForgotPasswordDto) => {
    setState((p) => ({ ...p, isLoading: true, lastError: null }));
    const { error } = await supabase.auth.resetPasswordForEmail(dto.email);
    if (error) {
      setState((p) => ({ ...p, isLoading: false, lastError: mapError(error) }));
      return null;
    }
     setState((p) => ({ ...p, isLoading: false }));
    return { detail: 'تم إرسال رابط إعادة التعيين إلى بريدك' } as ForgotPasswordResult;
  }, []);

  // إعادة تعيين كلمة السر
    const resetPassword = useCallback(async (dto: PasswordResetDto) => {
    setState((p) => ({ ...p, isLoading: true, lastError: null }));
    const { error } = await supabase.auth.updateUser({ password: dto.new_password });
    if (error) {
      setState((p) => ({ ...p, isLoading: false, lastError: mapError(error) }));
      return null;
    }
    setState((p) => ({ ...p, isLoading: false }));
    return { detail: 'تم تغيير كلمة السر بنجاح' } as PasswordResetResult;
  }, []);

  // تسجيل خروج
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setState((p) => ({ ...p, user: null, token: null, lastError: null }));
    return true;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginWithGoogle,
        register,
        verifyEmail,
        resendOtp,
        forgotPassword,
        resetPassword,
        logout,
        clearError,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): UseAuth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}