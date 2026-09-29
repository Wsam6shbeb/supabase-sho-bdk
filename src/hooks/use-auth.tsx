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
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// يكمل نافذة OAuth على الويب عند رجوع Google إلى نفس التطبيق.
WebBrowser.maybeCompleteAuthSession();

export interface AuthState {
  user: User | null;
  token: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  lastError: ApiError | null;
}

export interface UseAuth extends AuthState {
  login: (dto: LoginDto) => Promise<AuthResult | null>;
  loginWithGoogle: (dto?: GoogleLoginDto) => Promise<AuthResult | null>;
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

// يجلب بيانات الحساب الحقيقية من public.users بعد نجاح تسجيل الدخول.
// هذا يجعل جدول users هو مصدر بيانات الحساب، بينما تبقى auth.users مسؤولاً عن الجلسة.
async function loadUserProfile(sbUser: any): Promise<User> {
  const fallback = mapSupabaseUser(sbUser);

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, phone, region, avatar_url, is_provider, verification_status, created_at')
      .eq('id', sbUser.id)
      .maybeSingle();

    if (error || !data) return fallback;

    return {
      ...fallback,
      id: data.id,
      name: data.full_name || fallback.name,
      phone: data.phone || fallback.phone,
      region: data.region
        ? { id: data.region, name_ar: data.region }
        : fallback.region,
      avatar_url: data.avatar_url ?? fallback.avatar_url,
      has_provider_profile: data.is_provider,
      verification_status: data.verification_status as VerificationStatus,
      created_at: data.created_at,
    };
  } catch {
    return fallback;
  }
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
          const user = await loadUserProfile(data.session.user);
          setState((p) => ({
            ...p,
            user,
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
        void loadUserProfile(session.user).then((user) => {
          if (cancelled) return;
          setState((p) => ({
            ...p,
            user,
            token: session.access_token,
            isInitialized: true,
            lastError: null,
          }));
        });
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

    const user = await loadUserProfile(data.user);
    setState((p) => ({
      ...p,
      user,
      token: data.session?.access_token ?? null,
      isLoading: false,
      lastError: null,
    }));
    return { user, access: data.session?.access_token ?? '', refresh: data.session?.refresh_token ?? '' } as AuthResult;
  }, []);

  // تسجيل الدخول عبر Google باستخدام Supabase OAuth + PKCE.
  // على الهاتف نرجع إلى scheme الخاص بالتطبيق: shobdk://oauth/google.
  // على الويب نرجع إلى نفس origin حتى تغلق نافذة OAuth وتعود للجلسة.
  const loginWithGoogle = useCallback(async (_dto?: GoogleLoginDto) => {
    setState((p) => ({ ...p, isLoading: true, lastError: null }));

    try {
      const redirectTo =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : Linking.createURL('oauth/google');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        const apiErr = mapError(error);
        setState((p) => ({ ...p, isLoading: false, lastError: apiErr }));
        return null;
      }

      if (!data.url) {
        const apiErr = {
          code: 'GOOGLE_OAUTH_URL_MISSING',
          message: 'تعذر إنشاء رابط تسجيل الدخول عبر Google.',
        };
        setState((p) => ({ ...p, isLoading: false, lastError: apiErr }));
        return null;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type !== 'success' || !result.url) {
        if (result.type !== 'cancel' && result.type !== 'dismiss') {
          setState((p) => ({
            ...p,
            isLoading: false,
            lastError: {
              code: 'GOOGLE_OAUTH_CANCELLED',
              message: 'لم يكتمل تسجيل الدخول عبر Google.',
            },
          }));
        } else {
          setState((p) => ({ ...p, isLoading: false }));
        }
        return null;
      }

      const callbackUrl = new URL(result.url);

      // نقرأ نتيجة OAuth من query وhash لأن المنصة قد تعيدها بإحدى الطريقتين.
      const params = new URLSearchParams(callbackUrl.search);
      const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''));

      const oauthError =
        params.get('error_description') ||
        params.get('error') ||
        hashParams.get('error_description') ||
        hashParams.get('error');

      if (oauthError) {
        const apiErr = {
          code: params.get('error') ?? hashParams.get('error') ?? 'GOOGLE_OAUTH_ERROR',
          message: oauthError,
        };
        setState((p) => ({ ...p, isLoading: false, lastError: apiErr }));
        return null;
      }

      // المسار المعتاد مع PKCE: نستلم code ونستبدله بجلسة Supabase.
      const code = params.get('code') ?? hashParams.get('code');

      let sessionData: any = null;
      let exchangeError: any = null;

      if (code) {
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        sessionData = exchanged.data;
        exchangeError = exchanged.error;
      } else {
        // بعض تدفقات OAuth تعيد access/refresh tokens داخل hash.
        const accessToken = hashParams.get('access_token') ?? params.get('access_token');
        const refreshToken = hashParams.get('refresh_token') ?? params.get('refresh_token');

        if (accessToken && refreshToken) {
          const session = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          sessionData = session.data;
          exchangeError = session.error;
        }
      }

      if (exchangeError || !sessionData?.session?.user) {
        const apiErr = mapError(exchangeError ?? {
          code: 'GOOGLE_SESSION_MISSING',
          message: 'عادت Google بنجاح، لكن تعذر إنشاء جلسة المستخدم داخل التطبيق.',
        });
        setState((p) => ({ ...p, isLoading: false, lastError: apiErr }));
        return null;
      }

      const user = await loadUserProfile(sessionData.session.user);
      void ensureUserProfile(sessionData.session.user);

      setState((p) => ({
        ...p,
        user,
        token: sessionData.session!.access_token,
        isLoading: false,
        lastError: null,
      }));

      return {
        user,
        access: sessionData.session.access_token,
        refresh: sessionData.session.refresh_token,
        is_new_user: Boolean(sessionData.user?.created_at === sessionData.user?.updated_at),
      } as AuthResult;
    } catch (err) {
      const apiErr = mapError(err);
      setState((p) => ({ ...p, isLoading: false, lastError: apiErr }));
      return null;
    }
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
  // نمسح حالة المستخدم محلياً حتى لا يبقى التطبيق عالقاً إذا تأخر طلب Supabase.
  const logout = useCallback(async () => {
    // نمسح الحالة المحلية فوراً حتى ينتقل التطبيق لشاشة الدخول
    // حتى لو كان طلب Supabase بطيئاً أو الشبكة غير متاحة.
    setState((p) => ({
      ...p,
      user: null,
      token: null,
      lastError: null,
      isLoading: false,
    }));

    try {
      // إنهاء الجلسة المحلية المحفوظة على الجهاز/المتصفح.
      const { error } = await supabase.auth.signOut({ scope: 'local' });

      if (error) {
        console.error('[Supabase][logout] فشل إنهاء جلسة Supabase المحلية:', error.message);
      }
    } catch (error) {
      console.error('[Supabase][logout] خطأ أثناء تسجيل الخروج:', error);
    }

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