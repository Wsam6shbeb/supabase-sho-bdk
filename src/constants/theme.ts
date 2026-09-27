// ===============================================================
// شرح الملف: هذا ثوابت وإعدادات مشتركة (theme).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import '@/global.css';

import { Platform, StyleSheet } from 'react-native';

// ═══════════════════════════════════════════════════════════
// ثوابت التصميم والألوان والثيمات
// ═══════════════════════════════════════════════════════════

/** ألوان العلامة التجارية */
export const BrandColors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#60A5FA',
  urgent: '#F59E0B',
  urgentDark: '#D97706',
  urgentLight: '#FBBF24',
  success: '#10B981',
  successDark: '#059669',
  successLight: '#6EE7B7',
  warning: '#EAB308',
  warningDark: '#CA8A04',
  warningLight: '#FDE047',
  danger: '#EF4444',
  dangerDark: '#DC2626',
  dangerLight: '#FCA5A5',
} as const;

/** ألوان الثيمات (فاتح وداكن) */
export const Colors = {
  light: {
    text: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    background: '#FFFFFF',
    backgroundSecondary: '#F9FAFB',
    backgroundElevated: '#FFFFFF',
    backgroundElement: '#F3F4F6',
    backgroundSelected: '#E5E7EB',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    inputBackground: '#F9FAFB',
    primary: BrandColors.primary,
    primaryContrast: '#FFFFFF',
    urgent: BrandColors.urgent,
    urgentContrast: '#FFFFFF',
    success: BrandColors.success,
    successContrast: '#FFFFFF',
    warning: BrandColors.warning,
    danger: BrandColors.danger,
    dangerContrast: '#FFFFFF',
    overlay: 'rgba(17, 24, 39, 0.5)',
  },
  dark: {
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary: '#9CA3AF',
    background: '#0F172A',
    backgroundSecondary: '#1E293B',
    backgroundElevated: '#1E293B',
    backgroundElement: '#334155',
    backgroundSelected: '#475569',
    border: '#334155',
    borderLight: '#1E293B',
    inputBackground: '#1E293B',
    primary: BrandColors.primaryLight,
    primaryContrast: '#0F172A',
    urgent: BrandColors.urgentLight,
    urgentContrast: '#0F172A',
    success: BrandColors.successLight,
    successContrast: '#0F172A',
    warning: BrandColors.warningLight,
    danger: BrandColors.dangerLight,
    dangerContrast: '#0F172A',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

/** نوع لون الثيم */
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** الخطوط حسب المنصة */
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** أحجام الخطوط */
export const FontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 19,
  '2xl': 22,
  '3xl': 28,
  '4xl': 34,
} as const;

/** أوزان الخطوط */
export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

/** مسافات التخطيط */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  seven: 32,
  eight: 40,
  nine: 48,
  ten: 64,
} as const;

/** زوايا الحواف */
export const Radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

/** سمك الحدود */
export const BorderWidth = {
  hairline: StyleSheet.hairlineWidth ?? 0.5,
  thin: 1,
  thick: 2,
} as const;

/** الظلال */
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

/** درجات الشفافية */
export const Opacity = {
  disabled: 0.5,
  pressed: 0.7,
  overlay: 0.5,
} as const;

/** المسافة السفلية للتبويبات */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
/** أقصى عرض للمحتوى */
export const MaxContentWidth = 800;
