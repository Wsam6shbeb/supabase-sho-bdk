// ===============================================================
// شرح الملف: هذا بيانات/خدمات تجريبية Mock (auth.mock).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: getRegionById، buildMockUser، getRegions، login، register، forgotPassword، verifyEmail، resendOtp، refresh، resetPassword، changePassword، google، getCurrentUser، logout.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// محاكاة API المصادقة
// ═══════════════════════════════════════════════════════════

import type {
    AuthResult,
    ForgotPasswordDto,
    ForgotPasswordResult,
    LoginDto,
    RegisterDto,
    User,
} from '@/types/auth';
import type { ApiResponse, Region } from '@/types/common';
import { VerificationStatus } from '@/types/common';
import { mockApiCall, randomId } from './apiClient';

/** المناطق السورية */
export const SYRIAN_REGIONS: Region[] = [
  { id: 'r-damascus', name_ar: 'دمشق' },
  { id: 'r-aleppo', name_ar: 'حلب' },
  { id: 'r-homs', name_ar: 'حمص' },
  { id: 'r-hama', name_ar: 'حماه' },
  { id: 'r-lattakia', name_ar: 'اللاذقية' },
  { id: 'r-tartous', name_ar: 'طرطوس' },
  { id: 'r-idlib', name_ar: 'إدلب' },
  { id: 'r-daraa', name_ar: 'درعا' },
  { id: 'r-sweida', name_ar: 'السويداء' },
  { id: 'r-quneitra', name_ar: 'القنيطرة' },
  { id: 'r-deirezzor', name_ar: 'دير الزور' },
  { id: 'r-rakka', name_ar: 'الرقة' },
  { id: 'r-hasakeh', name_ar: 'الحسكة' },
];

/** الحصول على منطقة بالمعرف */
// [شرح الدالة: getRegionById] يبحث عن المنطقة التجريبية المطابقة للمعرّف المعطى.
export function getRegionById(regionId: string): Region {
  return (
    SYRIAN_REGIONS.find((r) => r.id === regionId) ?? SYRIAN_REGIONS[0]
  );
}

/** حساب تجريبي للاختبار */
const VALID_DEMO_ACCOUNT: LoginDto = {
  email: 'user@test.com',
  password: '123456',
};

/** تخزين المستخدم والرمز الحاليين */
let storedUser: User | null = null;
let storedToken: string | null = null;
const usedEmails = new Set<string>();

/** بناء مستخدم وهمي */
// [شرح الدالة: buildMockUser] ينشئ مستخدمًا تجريبيًا بالبيانات المطلوبة لاستخدامه أثناء التطوير.
function buildMockUser(overrides: Partial<User> & { name: string; email: string; phone: string; region: Region }): User {
  return {
    id: randomId('usr'),
    avatar_url: overrides.avatar_url ?? null,
    has_provider_profile: false,
    provider_profile: null,
    verification_status: VerificationStatus.NOT_VERIFIED,
    balance: 0,
    received_welcome_bonus: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** الحصول على قائمة المناطق */
// [شرح الدالة: getRegions] يعيد قائمة المناطق المتاحة في البيانات التجريبية.
export function getRegions(): Promise<ApiResponse<Region[]>> {
  return mockApiCall({
    resolver: () => SYRIAN_REGIONS,
  });
}

/** تسجيل الدخول */
// [شرح الدالة: login] ينفذ عملية تسجيل الدخول عبر طبقة المصادقة الحالية.
export function login(dto: LoginDto): Promise<ApiResponse<AuthResult>> {
  return mockApiCall({
    resolver: () => {
      const isDemo =
        dto.email.trim().toLowerCase() === VALID_DEMO_ACCOUNT.email.trim().toLowerCase() &&
        dto.password === VALID_DEMO_ACCOUNT.password;

      if (!isDemo) {
        const err = new Error();
        (err as unknown as { code?: string }).code = 'INVALID_CREDENTIALS';
        throw err;
      }

      const region = getRegionById('r-damascus');
      const user = storedUser ?? buildMockUser({
        id: 'usr_demo',
        name: 'أحمد محمد',
        email: VALID_DEMO_ACCOUNT.email,
        phone: '0991234567',
        region,
        balance: 50,
        verification_status: VerificationStatus.NOT_VERIFIED,
        has_provider_profile: false,
      });

      usedEmails.add(user.email.toLowerCase());
      storedUser = user;
      storedToken = randomId('tok');

      return { access: storedToken, refresh: storedToken + '_refresh', user, needs_profile: true, is_new_user: false };
    },
    forceError: false,
    errorOverride: {
      code: 'INVALID_CREDENTIALS',
      message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    },
  });
}

/** إنشاء حساب جديد */
// [شرح الدالة: register] ينفذ عملية إنشاء حساب مستخدم جديد.
export function register(dto: RegisterDto): Promise<ApiResponse<RegisterResult>> {
  return mockApiCall({
    resolver: () => {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (usedEmails.has(normalizedEmail)) {
        const err = new Error();
        (err as unknown as { code?: string }).code = 'EMAIL_USED';
        throw err;
      }

      const region = getRegionById(dto.region_id);
      const user = buildMockUser({
        name: dto.name.trim(),
        email: normalizedEmail,
        phone: dto.phone.trim(),
        region,
      });

      usedEmails.add(normalizedEmail);
      storedUser = user;
      storedToken = randomId('tok');

      return { access: storedToken, refresh: storedToken + '_refresh', user, needs_profile: true, is_new_user: false };
    },
    forceError: false,
    errorOverride: {
      code: 'EMAIL_USED',
      message: 'البريد الإلكتروني مستخدم بالفعل',
    },
  });
}

/** استعادة كلمة المرور */
// [شرح الدالة: forgotPassword] يبدأ عملية استعادة كلمة المرور للمستخدم.
export function forgotPassword(dto: ForgotPasswordDto): Promise<ApiResponse<ForgotPasswordResult>> {
  void dto;
  return mockApiCall({ resolver: () => ({ detail: 'تم إرسال رمز الاستعادة إلى بريدك الإلكتروني', resend_after_seconds: 60 }) });
}

// [شرح الدالة: verifyEmail] يتحقق من رمز/بيانات تأكيد البريد الإلكتروني.
export function verifyEmail(dto: VerifyEmailDto): Promise<ApiResponse<AuthResult>> {
  return mockApiCall({ resolver: () => {
    if (!storedUser) throw Object.assign(new Error(), { code: 'INVALID_OTP' });
    storedToken = randomId('tok');
    return { access: storedToken, refresh: storedToken + '_refresh', user: storedUser, needs_profile: true, is_new_user: true };
  }, errorOverride: { code: 'INVALID_OTP', message: 'رمز التحقق غير صحيح' } });
}
// [شرح الدالة: resendOtp] يعيد إرسال رمز التحقق للمستخدم.
export function resendOtp(_dto: ResendOtpDto): Promise<ApiResponse<ResendOtpResult>> {
  return mockApiCall({ resolver: () => ({ detail: 'تم إرسال رمز تحقق جديد', resend_after_seconds: 60 }) });
}
// [شرح الدالة: refresh] يطلب رمز جلسة/وصول جديد اعتمادًا على رمز التحديث.
export function refresh(_refresh: string): Promise<ApiResponse<{ access: string }>> {
  return mockApiCall({ resolver: () => ({ access: storedToken ?? randomId('tok') }) });
}
// [شرح الدالة: resetPassword] ينفذ تغيير كلمة المرور باستخدام بيانات إعادة التعيين.
export function resetPassword(_dto: PasswordResetDto): Promise<ApiResponse<PasswordResetResult>> {
  return mockApiCall({ resolver: () => ({ detail: 'تم تغيير كلمة المرور' }) });
}
// [شرح الدالة: changePassword] ينفذ تغيير كلمة مرور المستخدم الحالي.
export function changePassword(_dto: any): Promise<ApiResponse<{ detail: string }>> {
  return mockApiCall({ resolver: () => ({ detail: 'تم تغيير كلمة المرور' }) });
}
// [شرح الدالة: google] ينفذ تسجيل الدخول عبر Google من خلال الـ API.
export function google(_dto: GoogleLoginDto): Promise<ApiResponse<AuthResult>> {
  return mockApiCall({ resolver: () => {
    storedToken = randomId('tok');
    const user = storedUser ?? buildMockUser({ name: 'Google User', email: 'google@example.com', phone: '', region: SYRIAN_REGIONS[0] });
    storedUser = user;
    return { access: storedToken, refresh: storedToken + '_refresh', user, needs_profile: true, is_new_user: !storedUser };
  }});
}
/** الحصول على المستخدم الحالي */
// [شرح الدالة: getCurrentUser] يجلب بيانات المستخدم الحالي من الـ Backend.
export function getCurrentUser(): Promise<ApiResponse<User>> {
  return mockApiCall({
    resolver: () => {
      if (!storedUser || !storedToken) {
        const err = new Error();
        (err as unknown as { code?: string }).code = 'UNAUTHORIZED';
        throw err;
      }
      return storedUser;
    },
    forceError: false,
    errorOverride: {
      code: 'UNAUTHORIZED',
      message: 'لم يتم تسجيل الدخول',
    },
  });
}

/** تسجيل الخروج */
// [شرح الدالة: logout] ينفذ تسجيل خروج المستخدم ويُنهي الجلسة الحالية.
export function logout(): Promise<ApiResponse<void>> {
  return mockApiCall({
    resolver: () => {
      storedUser = null;
      storedToken = null;
      return undefined as void;
    },
  });
}
