// عرض التقييم: مقدم الخدمة الجديد (بدون تقييمات حقيقية بعد) يظهر "جديد" بدل رقم 5.0 غير حقيقي.
// الرقم الفعلي (فيه التقييمات الوهمية الأربعة) يُستعمل للترتيب والإخفاء فقط.
export function formatRating(avg: number, realCount?: number): string {
  if (realCount === 0) return 'جديد';
  return Number.isFinite(avg) ? avg.toFixed(1) : '—';
}
