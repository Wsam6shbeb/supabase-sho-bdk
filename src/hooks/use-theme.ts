// ===============================================================
// شرح الملف: هذا Hook لإدارة منطق مشترك (use-theme).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: useTheme.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

/**
 * Hook للحصول على الثيم الحالي (فاتح أو داكن)
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from '@/hooks/use-color-scheme';

export type Theme = 'light' | 'dark';

// [شرح الدالة: useTheme] يعيد الثيم الحالي الذي تستخدمه مكونات التطبيق.
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const theme = scheme === 'unspecified' ? 'light' : scheme;

  return theme as Theme;
}
