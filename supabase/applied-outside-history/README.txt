================================================================
اقرأني: ليش هالملفات التلاتة موجودين هون (وليس في مجلد migrations)
================================================================
كُتب بتاريخ: 2026-11-10
المجلد: supabase\applied-outside-history

----------------------------------------------------------------
1) الخلاصة بسطرين
----------------------------------------------------------------
هالملفات التلاتة كانوا بمجلد supabase\migrations تبع التطبيق، لكن
تغييراتهم موجودة فعلاً على قاعدة بيانات الإنتاج، من دون ما تكون
مسجّلة بسجل الـ migrations تبعها (غالباً انطبقوا من SQL Editor).
لهيك أخرجتهم من مجلد migrations وحطيتهم هون، وما لازم يرجعوا لهناك.

----------------------------------------------------------------
2) شو صار بالضبط (التسلسل)
----------------------------------------------------------------
- بدّلنا محتوى supabase\migrations بنسخة من سجل الإنتاج الحقيقي
  (مصدرها: C:\work\sho-prod\supabase\migrations، المربوط بمشروع
  الإنتاج ref = cmflpnweojteblxrpzgq).
  السبب: المجلد القديم كان ناقص، وأرقام ملفاته (timestamps) مختلفة
  عن سجل الإنتاج.
- النسخة الاحتياطية من مجلد migrations القديم (قبل التبديل):
  C:\work\migrations-backup-app
  (فيها الملفات الأصلية التلاتة بأسمائها وأرقامها الأصلية).
- قارنّا الملفات بالأسماء، فظهر 6 ملفات موجودة بالتطبيق وما لها
  اسم مطابق بالإنتاج:
    * 3 منها مغطّاة بملفات لاحقة بالإنتاج (تم تجاهلها، لا تحتاج شي):
        - 20261009090000_block_phone_numbers_in_chat.sql
        - 20261009094500_match_fallback_candidates.sql
        - 20261024120000_phone_share_only_while_active.sql
    * 3 منها ما لها أثر بسجل الإنتاج، فتحققنا من الإنتاج مباشرة
      (هدول اللي بهالمجلد، شوف الفقرة 3).

----------------------------------------------------------------
3) الملفات التلاتة وشو بتعمل
----------------------------------------------------------------
(أ) 20261010032000_disable_rating_received_notifications.sql
    - بتحذف الـ trigger ratings_notify_trg والدالة notify_on_rating.
    - الأثر: ما يوصل إشعار لأي طرف لما أحد يقيّم.
    - حالة الإنتاج: مطبّق (الاثنين غير موجودين).

(ب) 20261010120000_include_active_orders_in_history.sql
    - بتعيد تعريف الدالة get_my_order_history_v2 لتظهر الطلبات
      النشطة (active) بسجل الطلبات لكلا الطرفين.
    - حالة الإنتاج: مطبّق.

(ج) 20261019080000_provider_minimum_balance_search_gate.sql
    - بتعدّل الدالة get_provider_candidates بحيث يُستبعد المزوّد
      اللي رصيده المتاح أقل من إعداد commission_max، قبل مطابقة الـ AI.
    - حالة الإنتاج: مطبّق.
    - تنبيه: الملف بيعدّل الدالة بالاستبدال النصي، ولو ما لقي النص
      المتوقع بيرمي خطأ:
        "Could not find expected provider eligibility condition;
         no change made"
      وما بيغيّر شي. يعني لو انشغّل على الإنتاج بيطلع خطأ لأنو
      الشرط موجود أصلاً.

----------------------------------------------------------------
4) كيف تحققنا (2026-11-10، على الإنتاج، قراءة فقط)
----------------------------------------------------------------
نتيجة استعلام SQL Editor:
  A1 ratings_notify_trg موجود؟              false  (يعني الإشعار ملغى)
  A2 notify_on_rating موجودة؟               false
  B  شرط commission_max داخل الدالة؟        true
  C  الطلبات النشطة بسجل الطلبات؟           true

الاستعلام (لإعادة التحقق بأي وقت):

select 'A1_trigger_ratings_notify_trg_exists' as check_name,
       exists(select 1 from pg_trigger where tgname = 'ratings_notify_trg' and not tgisinternal) as result
union all
select 'A2_function_notify_on_rating_exists',
       exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'notify_on_rating')
union all
select 'B_balance_gate_in_get_provider_candidates',
       position('commission_max' in pg_get_functiondef('public.get_provider_candidates(uuid,integer)'::regprocedure)) > 0
union all
select 'C_active_orders_in_order_history',
       position('''active'', ''completion_pending_rating''' in pg_get_functiondef('public.get_my_order_history_v2()'::regprocedure)) > 0;

----------------------------------------------------------------
5) ليش مو بمجلد migrations
----------------------------------------------------------------
- سجل الإنتاج ما فيه هالملفات، فوجودها بمجلد migrations بيخلّي
  الـ CLI يشوف عدم تطابق (Local مقابل Remote).
- لو انطبّقوا على الإنتاج من جديد: الملف (ج) بيرمي خطأ، والتاني
  ممكن يعيد تعريف دوال موجودة.
- لا تعمل supabase db push على الإنتاج بسبب هالملفات.

----------------------------------------------------------------
6) متى وكيف تستخدمهم
----------------------------------------------------------------
فقط عند بناء قاعدة بيانات جديدة من ملفات migrations (مثلاً مشروع
الاختبار sho-bdk-job-opportunities-test، ref = lumbdpqduchdywyrzpvk)
وبدك تطلع مطابقة للإنتاج:
  1. طبّق كل ملفات supabase\migrations أولاً.
  2. بعدها طبّق هالملفات يدوياً (SQL Editor أو psql) بهالترتيب:
       أ) disable_rating_received_notifications
       ب) include_active_orders_in_history
       ج) provider_minimum_balance_search_gate
  3. إذا (ج) رمى خطأ "Could not find expected ...": يعني تعريف
     get_provider_candidates بقاعدتك الجديدة مختلف عن المتوقع.
     لا تجبر الملف. قارن الدالة مع الإنتاج، أو انسخ تعريفها من
     الإنتاج مباشرة.

----------------------------------------------------------------
7) الحل النظيف مستقبلاً (اختياري)
----------------------------------------------------------------
تحويل هالتلاتة لـ migrations رسمية بأرقام جديدة أحدث من آخر ملف
بالإنتاج، بحيث تتسجل بالسجل ويتوحّد كل شي. قبل هيك لازم تتأكد
إنو تطبيقها على الإنتاج ما بيعمل شي غير مرغوب (ملف (ج) لازم يتعدّل
ليصير آمن لو الشرط موجود). لا تعمل هذا الشي بدون مراجعة.

----------------------------------------------------------------
8) أماكن مرتبطة
----------------------------------------------------------------
- نسخة سجل الإنتاج:        C:\work\sho-prod\supabase\migrations
- نسخة احتياطية قديمة:      C:\work\migrations-backup-app
- مشروع الإنتاج (ref):     cmflpnweojteblxrpzgq
- مشروع الاختبار (ref):    lumbdpqduchdywyrzpvk
- الفرع المستخدم بالتبديل: chore/sync-prod-migrations
