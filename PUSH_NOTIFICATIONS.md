# إشعارات Push — الإعداد والتشغيل

## كيف تعمل
1. التطبيق يسجّل رمز Expo Push للجهاز عند الدخول (`register_push_token` ← جدول `push_tokens`).
2. أي إشعار جديد في جدول `notifications` (رسالة، اتفاق، إنهاء، تقييم…) يشغّل trigger `notifications_push_trg`.
3. الـ trigger يستدعي دالة Edge `send-push` عبر `pg_net` مع سرّ مشترك مخزّن في Vault (`push_webhook_secret`).
4. الدالة تقرأ أجهزة المستخدم وترسل عبر Expo Push API، وتحذف الأجهزة غير الصالحة تلقائياً.
5. النقر على الإشعار يفتح الشاشة المحددة في `payload.route`.

الرسائل المتتالية في نفس المحادثة تُجمَّع في إشعار واحد داخل التطبيق، لكن كل رسالة جديدة ترسل Push مستقلاً.

## ما يلزم من جهتك (لا يمكن أتمتته)
1. **مشروع EAS:** `npx eas init` (يضيف `extra.eas.projectId` إلى `app.json`). بدونه يتخطى التطبيق التسجيل ويكتب تحذيراً في السجل.
2. **بناء dev client / EAS build:** الإشعارات لا تعمل في Expo Go ولا في المحاكي. بعد إضافة `expo-notifications` لازم بناء جديد:
   `npx expo prebuild` ثم `eas build` (أو `npx expo run:android`).
3. **Android:** أنشئ مشروع Firebase وأضف `google-services.json` (مسار `android.googleServices` في `app.json`)، ثم ارفع مفتاح FCM V1 إلى EAS: `eas credentials`.
4. **iOS:** حساب Apple Developer + مفتاح APNs عبر `eas credentials`.

## اختبار سريع
بعد تسجيل الدخول على جهاز حقيقي ثم إرسال رسالة من حساب آخر، يجب أن يصل الإشعار والتطبيق مغلق.
لفحص الخط يدوياً من SQL Editor:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_function_url'),
  body := jsonb_build_object('notification_id', '<notification uuid>'),
  headers := jsonb_build_object('Content-Type', 'application/json',
    'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret'))
);
select status_code, content from net._http_response order by id desc limit 1;
```

## ملاحظات أمان
- الدالة `send-push` منشورة بـ `verify_jwt = false` لأن المستدعي هو قاعدة البيانات؛ الحماية بالسرّ المشترك (403 بدونه).
- دور `service_role` في هذا المشروع بلا صلاحيات مباشرة على الجداول، لذلك تعمل الدالة عبر RPC ضيقة فقط: `get_push_secret`, `get_push_targets`, `remove_push_tokens`.
