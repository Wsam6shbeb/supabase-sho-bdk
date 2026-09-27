# Frontend Data Layer (Supabase)

هذا المشروع متصل مباشرة بـ Supabase (لا يوجد backend وسيط مثل Django).

## البنية

```text
Screen
  ↓
Hook / Context
  ↓
src/services/supabase.ts  (عميل Supabase)
  أو
src/services/api  (مناطق ثابتة، مزوّد mock، محفظة)
```

## نقاط الاتصال الحالية

- **المصادقة (Auth)**: `src/hooks/use-auth.tsx` يستخدم `supabase.auth` مباشرة
  (تسجيل دخول/إنشاء حساب/استرجاع كلمة مرور/جلسة).
- **المحفظة (Wallet)**: `src/services/api/walletAdapter.ts` يقرأ من جدولي
  `wallets` و`ledger_entries` مباشرة (محميّين بسياسات RLS تسمح فقط
  بصفوف المستخدم الحالي عبر `auth.uid()`).
- **المناطق**: `src/services/api/regions.ts` — قائمة ثابتة بالمحافظات السورية.
- **مزوّدو الخدمة، الطلبات، المحادثات، الاتفاقات، التقييمات، البلاغات،
  الإشعارات**: ما زالت تعمل على بيانات محلية/تجريبية (`src/mocks`,
  `src/context/OrderContext.tsx`) لحين تصميم الجداول المقابلة بـ Supabase.

## معروف وناقص حاليًا

- **"إضافة خدمة كمزوّد" (become provider)**: لا يوجد بعد جدول بمخطط
  Supabase (`supabase/migrations`) يقابل وصف الخدمة/سنوات الخبرة/نطاق
  السعر. التسجيل حاليًا محلي فقط ولا يُحفظ بقاعدة البيانات.

## متغيرات البيئة

انظر `.env.example`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (لتسجيل الدخول عبر Google)
