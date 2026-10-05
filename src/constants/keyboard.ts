// سلوك KeyboardAvoidingView لكل التطبيق في مكان واحد.
// Android الحديث يعمل بنمط edge-to-edge (المحتوى يُرسم تحت أشرطة النظام) فلا تتقلّص النافذة مع لوحة المفاتيح،
// لذلك نستخدم 'padding' على المنصتين. إذا ظهرت فجوة زائدة فوق لوحة المفاتيح على Android غيّر القيمة هنا فقط.
export const KEYBOARD_AVOIDING_BEHAVIOR = 'padding' as const;
