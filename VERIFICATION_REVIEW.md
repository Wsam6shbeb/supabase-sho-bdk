# مراجعة نظام التوثيق — فرع تجريبي

الفرع: `feature/real-verification`

هذا الفرع معزول عن `main`. يحتوي على Migration التوثيق، خدمة رفع الصور، hook حالة التوثيق، وتحديث شاشة `verify-account.tsx`.

## خطوة الربط المتبقية في profile.tsx

في `src/app/(drawer)/profile.tsx`:
1. بعد `import { useAuth } from '@/hooks/use-auth';` أضف:
```ts
import { useMyVerification } from '@/hooks/use-my-verification';
```
2. احذف `verificationStatus,` و`isVerified,` من destructuring الخاص بـ `useOrder()`.
3. بعد `} = useOrder();` أضف:
```ts
const { status: verificationStatus, isVerified } = useMyVerification();
```

## تنبيه
لم تُطبّق Migration على قاعدة البيانات. لا تُطبّقها على الإنتاج قبل مراجعة SQL، سياسات التخزين، وصيغة الاحتفاظ بسجلات التوثيق. هذه الملفات لم تُبنَ أو تُختبر كاملة بعد.
