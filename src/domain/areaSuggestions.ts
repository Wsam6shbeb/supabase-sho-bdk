// ===============================================================
// اقتراح (placeholder) لحقل "المنطقة" حسب المدينة المكتوبة: حي معروف من نفس المحافظة.
// للمدن غير الموجودة هنا يُترك الحقل بدون اقتراح بدل اختراع اسم غير صحيح.
// لإضافة محافظة: أضف سطراً جديداً (الاسم بدون "ال" وبالتاء المربوطة هاء، مثل: لاذقيه).
// ===============================================================
const AREA_SUGGESTIONS: Record<string, string> = {
  لاذقيه: 'المشروع السابع',
  دمشق: 'المزة',
  حلب: 'الفرقان',
  حمص: 'الوعر',
  حماه: 'الحاضر',
};

function normalizeCityKey(city: string): string {
  return city
    .trim()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/^محافظه\s+/, '')
    .replace(/^ال/, '');
}

export function areaPlaceholder(city: string): string {
  return AREA_SUGGESTIONS[normalizeCityKey(city)] ?? '';
}
