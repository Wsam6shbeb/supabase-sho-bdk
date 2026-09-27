// ===============================================================
// شرح الملف: هذا بيانات/خدمات تجريبية Mock (providers.mock).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: getRandomSkill، getRandomSkills، getRandomCardColor، getRandomRegion، buildMockProvider، getProviderById، searchProviders.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// محاكاة بيانات مقدمي الخدمة
// ═══════════════════════════════════════════════════════════

import type { ServiceProvider } from '@/types/orders';
import { randomId } from './apiClient';
import { SYRIAN_REGIONS, getRegionById } from './auth.mock';

/** ألوان بطاقات مقدمي الخدمة */
const CARD_COLORS = [
  { id: 'blue', name: 'أزرق', color: '#3B82F6', color_light: '#93C5FD' },
  { id: 'green', name: 'أخضر', color: '#10B981', color_light: '#6EE7B7' },
  { id: 'purple', name: 'بنفسجي', color: '#8B5CF6', color_light: '#C4B5FD' },
  { id: 'orange', name: 'برتقالي', color: '#F59E0B', color_light: '#FCD34D' },
  { id: 'pink', name: 'وردي', color: '#EC4899', color_light: '#F9A8D4' },
  { id: 'teal', name: 'تركواز', color: '#14B8A6', color_light: '#5EEAD4' },
  { id: 'indigo', name: 'نيلي', color: '#6366F1', color_light: '#A5B4FC' },
  { id: 'red', name: 'أحمر', color: '#EF4444', color_light: '#FCA5A5' },
];

/** المهارات المتاحة لمقدمي الخدمة */
const MOCK_SKILLS = [
  'سباكة',
  'كهرباء',
  'نجارة',
  'تركيب أثاث',
  'تكييف',
  'طلاء',
  'تنظيف',
  'نقل عفش',
  'إصلاح سيارات',
  'خدمات منزلية',
  'تصميم جرافيك',
  'برمجة',
  'ترجمة',
  'تدريس',
  'طبخ',
];

// [شرح الدالة: getRandomSkill] يختار مهارة تجريبية عشوائية.
function getRandomSkill(): string {
  return MOCK_SKILLS[Math.floor(Math.random() * MOCK_SKILLS.length)];
}

// [شرح الدالة: getRandomSkills] ينشئ مجموعة مهارات تجريبية عشوائية.
function getRandomSkills(count: number): string[] {
  const shuffled = [...MOCK_SKILLS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// [شرح الدالة: getRandomCardColor] يختار لونًا تجريبيًا عشوائيًا لبطاقة مقدم الخدمة.
function getRandomCardColor(): string {
  const color = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
  return color.color;
}

// [شرح الدالة: getRandomRegion] يختار منطقة تجريبية عشوائية.
function getRandomRegion() {
  return SYRIAN_REGIONS[Math.floor(Math.random() * SYRIAN_REGIONS.length)];
}

// [شرح الدالة: buildMockProvider] ينشئ مقدم خدمة تجريبيًا لاستخدامه في الواجهات والاختبارات.
function buildMockProvider(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  const region = overrides.region || getRandomRegion();
  const rating = 3.5 + Math.random() * 1.5;
  const totalOrders = Math.floor(10 + Math.random() * 490);
  const completion_rate = 0.7 + Math.random() * 0.3;
  const response_time_minutes = Math.floor(5 + Math.random() * 55);
  const cancellation_rate = Math.random() * 0.2;
  const balance = 20 + Math.random() * 80;

  return {
    id: randomId('prov'),
    name: overrides.name || `مقدم خدمة ${Math.floor(Math.random() * 100)}`,
    avatar_url: overrides.avatar_url || null,
    region,
    skills: overrides.skills || getRandomSkills(2 + Math.floor(Math.random() * 4)),
    rating: Math.round(rating * 10) / 10,
    total_orders: totalOrders,
    completion_rate: Math.round(completion_rate * 100) / 100,
    response_time_minutes: response_time_minutes,
    cancellation_rate: Math.round(cancellation_rate * 100) / 100,
    balance: Math.round(balance),
    is_available: overrides.is_available ?? true,
    verification_status: overrides.verification_status || 'not_verified',
    card_color: overrides.card_color || getRandomCardColor(),
    ...overrides,
  };
}

export const MOCK_PROVIDERS: ServiceProvider[] = [
  buildMockProvider({
    name: 'أحمد الحلبي',
    region: getRegionById('r-aleppo'),
    skills: ['سباكة', 'كهرباء', 'تركيب أثاث'],
    rating: 4.8,
    total_orders: 156,
    completion_rate: 0.95,
    response_time_minutes: 12,
    cancellation_rate: 0.05,
    balance: 75,
    verification_status: 'verified',
  }),
  buildMockProvider({
    name: 'محمد الدمشقي',
    region: getRegionById('r-damascus'),
    skills: ['تكييف', 'كهرباء', 'سباكة'],
    rating: 4.6,
    total_orders: 203,
    completion_rate: 0.92,
    response_time_minutes: 18,
    cancellation_rate: 0.08,
    balance: 85,
    verification_status: 'verified',
  }),
  buildMockProvider({
    name: 'خالد الحمصي',
    region: getRegionById('r-homs'),
    skills: ['نجارة', 'تركيب أثاث', 'طلاء'],
    rating: 4.5,
    total_orders: 89,
    completion_rate: 0.88,
    response_time_minutes: 25,
    cancellation_rate: 0.12,
    balance: 45,
    verification_status: 'not_verified',
  }),
  buildMockProvider({
    name: 'يوسف اللاذقاني',
    region: getRegionById('r-lattakia'),
    skills: ['تنظيف', 'خدمات منزلية', 'طبخ'],
    rating: 4.7,
    total_orders: 134,
    completion_rate: 0.94,
    response_time_minutes: 15,
    cancellation_rate: 0.06,
    balance: 60,
    verification_status: 'verified',
  }),
  buildMockProvider({
    name: 'عمر الحسكي',
    region: getRegionById('r-hasakeh'),
    skills: ['إصلاح سيارات', 'كهرباء', 'سباكة'],
    rating: 4.4,
    total_orders: 67,
    completion_rate: 0.85,
    response_time_minutes: 30,
    cancellation_rate: 0.15,
    balance: 35,
    verification_status: 'not_verified',
  }),
  buildMockProvider({
    name: 'علي التدمري',
    region: getRegionById('r-daraa'),
    skills: ['نجارة', 'بناء', 'طلاء'],
    rating: 4.3,
    total_orders: 45,
    completion_rate: 0.82,
    response_time_minutes: 35,
    cancellation_rate: 0.18,
    balance: 30,
    verification_status: 'not_verified',
  }),
  buildMockProvider({
    name: 'حسن السويري',
    region: getRegionById('r-sweida'),
    skills: ['برمجة', 'تصميم جرافيك', 'ترجمة'],
    rating: 4.9,
    total_orders: 98,
    completion_rate: 0.97,
    response_time_minutes: 8,
    cancellation_rate: 0.03,
    balance: 90,
    verification_status: 'verified',
  }),
  buildMockProvider({
    name: 'سيف الدرعاوي',
    region: getRegionById('r-daraa'),
    skills: ['تكييف', 'كهرباء'],
    rating: 4.2,
    total_orders: 38,
    completion_rate: 0.80,
    response_time_minutes: 40,
    cancellation_rate: 0.20,
    balance: 25,
    verification_status: 'not_verified',
  }),
];

// [شرح الدالة: getProviderById] يبحث عن مقدم خدمة تجريبي باستخدام المعرّف.
export function getProviderById(id: string): ServiceProvider | undefined {
  return MOCK_PROVIDERS.find((p) => p.id === id);
}

/**
 * البحث عن مقدمي الخدمة
 * @param description وصف الطلب
 * @param userRegion منطقة المستخدم (id)
 * @param isUrgent مستعجل؟
 */
// [شرح الدالة: searchProviders] يبحث داخل قائمة مقدمي الخدمة التجريبية وفق معايير البحث.
export function searchProviders(
  description: string,
  userRegion: string,
  isUrgent: boolean,
): ServiceProvider[] {
  const MIN_BALANCE = 10;

  let results = MOCK_PROVIDERS.filter((provider) => {
    if (provider.balance < MIN_BALANCE) return false;
    if (!provider.is_available) return false;
    return true;
  });

  // الترتيب
  results.sort((a, b) => {
    // ⭐ أولوية لمن هم في نفس منطقة المستخدم
    const aInRegion = a.region.id === userRegion ? 1 : 0;
    const bInRegion = b.region.id === userRegion ? 1 : 0;
    if (bInRegion !== aInRegion) return bInRegion - aInRegion;

    // ثم حسب باقي المعايير
    if (b.total_orders !== a.total_orders) return b.total_orders - a.total_orders;
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.completion_rate !== a.completion_rate)
      return b.completion_rate - a.completion_rate;
    if (a.response_time_minutes !== b.response_time_minutes)
      return a.response_time_minutes - b.response_time_minutes;
    if (a.cancellation_rate !== b.cancellation_rate)
      return a.cancellation_rate - b.cancellation_rate;
    return 0;
  });

  if (isUrgent) {
    results = results.slice(0, 5);
  }

  return results;
}