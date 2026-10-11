// ===============================================================
// أرقام الهاتف: نفس منطق دالة normalize_syrian_phone في قاعدة البيانات (للتحقق الفوري في الشاشة).
// الصيغ المقبولة: 09XXXXXXXX، 9XXXXXXXX، +9639XXXXXXXX، 009639XXXXXXXX (مع مسافات/شرطات وأرقام عربية).
// الناتج دائماً بصيغة دولية: +9639XXXXXXXX
// ===============================================================

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeSyrianPhone(input: string): string | null {
  let digits = input
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EASTERN_ARABIC_INDIC.indexOf(d)))
    .replace(/\D/g, '');

  if (digits.startsWith('00963')) digits = digits.slice(5);
  else if (digits.startsWith('963')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  return /^9\d{8}$/.test(digits) ? `+963${digits}` : null;
}

/** +963912345678 → +963 912 345 678 (للعرض فقط) */
export function formatPhoneForDisplay(e164: string): string {
  const m = /^\+963(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `+963 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
