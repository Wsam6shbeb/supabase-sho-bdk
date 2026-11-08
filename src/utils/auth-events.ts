// ===============================================================
// قرار التعامل مع أحداث Supabase Auth (دالة نقية قابلة للاختبار)
// ===============================================================
//
// المشكلة التي تحلّها: Supabase يطلق onAuthStateChange عند كل تجديد للتوكن
// (TOKEN_REFRESHED) وعند عودة التطبيق للواجهة (SIGNED_IN مكرر). كان التطبيق يعيد
// تحميل ملف المستخدم ويبني كائن user جديداً مع كل حدث، فيُنفَّذ router.replace('/(drawer)/(tabs)')
// بـ AppEntry ويرجع المستخدم للرئيسية. على جهاز ساعته غير مضبوطة يصير التجديد كل ثانية
// تقريباً (لأن التوكن يبدو منتهياً دائماً)، فلا يستطيع المستخدم فتح أي صفحة.

export type AuthEventAction =
  /** لا توجد جلسة: نمسح حالة المستخدم. */
  | 'clear'
  /** نفس المستخدم المحمّل مسبقاً: نحدّث التوكن فقط دون لمس كائن user ودون أي طلب شبكة. */
  | 'update-token'
  /** مستخدم جديد أو تغيّر حقيقي في الحساب: نحمّل الملف من القاعدة. */
  | 'load-profile';

const EVENTS_THAT_DO_NOT_CHANGE_THE_ACCOUNT = new Set(['TOKEN_REFRESHED', 'SIGNED_IN', 'INITIAL_SESSION']);

export function decideAuthEventAction(
  event: string,
  sessionUserId: string | null | undefined,
  loadedUserId: string | null,
): AuthEventAction {
  if (!sessionUserId) return 'clear';
  if (loadedUserId === sessionUserId && EVENTS_THAT_DO_NOT_CHANGE_THE_ACCOUNT.has(event)) {
    return 'update-token';
  }
  return 'load-profile';
}
