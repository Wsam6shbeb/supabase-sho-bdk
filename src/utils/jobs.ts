// ===============================================================
// دوال مساعدة صرفة لقسم فرص العمل (بلا واجهة ولا شبكة) كي يسهل اختبارها.
// ===============================================================

import { JOB_LIMITS } from '@/config/jobs';
import type { ContactType } from '@/types/jobs';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** يحوّل الأرقام الهندية (٠١٢...) إلى لاتينية (012...). */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** يوحّد قيمة وسيلة التواصل قبل الفحص والإرسال (نفس منطق الخادم). */
export function normalizeContactValue(type: ContactType, raw: string): string {
  const value = raw.trim();
  if (type === 'phone' || type === 'whatsapp') {
    return normalizeDigits(value).replace(/[\s\-().]/g, '');
  }
  if (type === 'link') {
    // نصحّح حالة الحروف في البروتوكول (لوحات المفاتيح تكبّر أول حرف) ونضيف https إذا نُسي.
    if (/^https?:\/\//i.test(value)) return value.replace(/^https?:\/\//i, (m) => m.toLowerCase());
    if (value.includes('.') && !/\s/.test(value)) return `https://${value}`;
  }
  return value;
}

/** رسالة خطأ بالعربية إذا كانت وسيلة التواصل غير صالحة، وإلا null. */
export function validateContact(type: ContactType, value: string): string | null {
  if (!value) return 'وسيلة التواصل مطلوبة.';
  if (value.length > 200) return 'وسيلة التواصل طويلة جداً.';
  switch (type) {
    case 'phone':
    case 'whatsapp':
      return /^\+?[0-9]{9,15}$/.test(value) ? null : 'أدخل رقماً صحيحاً (9 إلى 15 رقماً).';
    case 'email':
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? null : 'أدخل بريداً إلكترونياً صحيحاً.';
    case 'link':
      return /^https?:\/\/[^\s]+$/i.test(value) ? null : 'أدخل رابطاً صحيحاً يبدأ بـ https://';
  }
}

/** الرابط الذي يفتحه زر التواصل. أرقام 09xxxxxxxx تُحوَّل إلى الصيغة الدولية لسوريا في واتساب. */
export function buildContactUrl(type: ContactType, value: string): string {
  switch (type) {
    case 'phone':
      return `tel:${value}`;
    case 'whatsapp': {
      let digits = value.replace(/^\+/, '');
      if (digits.startsWith('00')) digits = digits.slice(2);
      else if (/^09\d{8}$/.test(digits)) digits = `963${digits.slice(1)}`;
      return `https://wa.me/${digits}`;
    }
    case 'email':
      return `mailto:${value}`;
    case 'link':
      return value;
  }
}

/** يقسّم مدخل الخبرات (مفصولة بفاصلة أو فاصلة عربية أو سطر جديد) إلى وسوم نظيفة. */
export function parseSkillInput(text: string): string[] {
  return text
    .split(/[,،؛;\n]/)
    .map((s) => s.replace(/\s+/g, ' ').trim().slice(0, JOB_LIMITS.skillMax))
    .filter(Boolean);
}

/** يضيف وسوماً جديدة للقائمة بدون تكرار وضمن الحد الأقصى. */
export function mergeSkills(current: string[], raw: string): string[] {
  const merged = [...current];
  for (const skill of parseSkillInput(raw)) {
    if (merged.length >= JOB_LIMITS.skillsCount) break;
    if (!merged.includes(skill)) merged.push(skill);
  }
  return merged;
}

/** ينظّف نص بحث قبل وضعه في فلتر PostgREST (يمنع كسر صيغة or/ilike). */
export function sanitizeFilterText(text: string): string {
  return text.replace(/[,()"'\\%*_{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "قبل 5 دقائق" وما شابه. */
export function timeAgoAr(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `قبل ${days} يوم`;
  return new Date(iso).toLocaleDateString('ar');
}

/** الأيام المتبقية على انتهاء الوظيفة (0 = تنتهي اليوم، سالب = منتهية). */
export function daysLeft(iso: string, now: number = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / 86400000);
}

export function isExpired(iso: string, now: number = Date.now()): boolean {
  return new Date(iso).getTime() <= now;
}

export function expiryLabel(iso: string, now: number = Date.now()): string {
  const left = daysLeft(iso, now);
  if (left < 0 || isExpired(iso, now)) return 'منتهية';
  if (left === 0) return 'تنتهي اليوم';
  return `تنتهي بعد ${left} يوم`;
}
