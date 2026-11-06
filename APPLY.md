# باتش أمني: شو بدك

**الأساس:** الفرع `security/ai-analysis-rate-limits` عند commit `b284937` (مو `main`).
**الحالة:** ما انعمل commit ولا merge ولا deploy، وما انطبق شي على Supabase. كل التجارب جرت على Postgres محلي مؤقت داخل الـ sandbox. على مشروعك الحقيقي صار قراءة فقط (SELECT وسجلات).

## 1. شو بالـ ZIP

```
APPLY.md
supabase/functions/_shared/safe-log.ts                       جديد
supabase/functions/match-service-providers/index.ts          معدّل (كامل)
supabase/functions/match-service-providers/match-core.ts     جديد
supabase/functions/_tests/                                   جديد (اختبارات Deno، ما بتنشر كدالة)
    deno.json, stubs/edge_runtime_stub.ts
    safe_log_test.ts, match_core_test.ts, match_handler_test.ts
supabase/migrations/20261105090000_lock_candidates_to_server_writes.sql      جديد
supabase/migrations/20261105091000_bound_provider_candidate_payload.sql      جديد
supabase/migrations/20261105092000_bound_provider_service_inputs.sql         جديد
supabase/migrations/20261105093000_phone_guard_structured_data.sql           جديد
supabase/rollback/20261105_rollback_security_patch.sql       يدوي فقط (خارج migrations)
supabase/tests/sql/01..03_*.sql, run_local.sh                اختبارات SQL
supabase/tests/sql/fixture/local_fixture.sql, 10..12_*.sql   اختبارات تحتاج DB تجريبي فقط
```

ما لمست أي ملف ثاني: لا كود التطبيق، ولا `tsconfig.json`، ولا `analyze-*`.

## 2. المشاكل، والإصلاح، والإثبات

| # | المشكلة | الإصلاح | الإثبات |
|---|---|---|---|
| 1 | الزبون بيقدر يضيف أي مستخدم كمرشح بجدول `candidates` | Migration 1 | `01` و`fixture/10` |
| 2 | مفتاح Gemini بالـ URL وبسجلات الأخطاء | `index.ts` و`safe-log.ts` | `match_handler_test.ts` |
| 3 | بيانات المزوّد بلا حد بالبرومبت، وحقن، وتسريب تواصل بـ `reason` | Migration 2 و3 و`match-core.ts` | `03` و`fixture/11` و`12` وCore/Handler |
| 4 | فلتر الهاتف ما بيغطي `structured_data` | Migration 4 | `02` |
| 5 | المسار القديم (legacy) بلا سقف حجم | `readJsonBodyLimited` والتنظيف | Handler (legacy) |

### 1) candidates
- **الملف:** `20261105090000_lock_candidates_to_server_writes.sql`.
- **الفحص قبل التعديل:**
  - كل `INSERT/UPDATE` على `candidates` كان عبر سياستين: `candidates_requester_insert` و`candidates_requester_update`.
  - ما في ولا دالة SECURITY DEFINER بـ `public` بتكتب على الجدول.
  - كود التطبيق الحالي ما بيكتب عليه (`grep` عند `b284937`). الكتابة الوحيدة من الدالة بـ `service_role`.
- **التعديل:**
  - حذف السياستين.
  - `REVOKE INSERT, UPDATE, DELETE, TRUNCATE` من `anon` و`authenticated`.
  - إبقاء `candidates_read` والسياسة RESTRICTIVE `active_account_required`.
  - `service_role` بيحتفظ بالكتابة.
- **ملاحظة:** نسخ التطبيق القديمة اللي كانت تكتب على `candidates` مباشرة رح تتوقف. هذا المقصود.

### 2) مفتاح Gemini
- **`index.ts`:** المفتاح صار بالـ header `x-goog-api-key` (متل `analyze-*`)، وما عاد بالـ URL.
- **السجلات:** أخطاء الدالة بتمر عبر `describeError` اللي بيحذف أي مفتاح أو `?query` أو Bearer أو JWT.
- **تحقق من Deno 2.9.6:** `console.error(e)` بيطبع `[cause]` فيه الـ URL كامل مع `?key=...`، وهيك كان الكود الأصلي بيسرّب المفتاح عند أي خطأ شبكة.
- **تحذير:** هذا من Deno CLI. افترضت إن runtime Supabase بيتصرف نفس الشي.

### 3) تضخيم المدخلات والحقن وتسريب التواصل
- **`match-core.ts` (طبقة Edge):**
  - whitelist للحقول مع سقوف: 3 خدمات لكل مزوّد، وميزانية 4000 حرف لكل مزوّد و4000 للطلب، والتصنيف من القائمة المسموحة فقط.
  - حذف محارف التحكم والـ bidi والصفر-عرض، وتعطيل `<<<`/`>>>` حتى ما يقلّد المستخدم فواصل البرومبت.
  - `systemInstruction` بتعتبر البيانات غير موثوقة، والبيانات محاطة بـ `BEGIN_UNTRUSTED/END_UNTRUSTED`.
  - `reason`: إذا فيه رقم هاتف أو رابط أو بريد أو `@handle` أو اسم تطبيق مراسلة، بيستبدل بجملة محايدة. السقف 160 حرف.
  - حذف المكرر من `provider_id` وتثبيت الدرجة بين 0 و100.
  - سقف 256KB لحجم الـ body (بالقراءة المتدفقة، حتى بلا `content-length`)، والرد 413.
  - يطبّق نفس التنظيف على المسار القديم (legacy).
- **Migration 2 (طبقة DB):**
  - دالتان مساعدتان `bound_text_array` و`bound_provider_service_json` (صلاحياتهما `service_role` فقط).
  - `get_provider_candidates` بترجع 5 خدمات كحد أقصى لكل مزوّد، بمفاتيح معروفة وأطوال محدودة.
  - التعديل بنص مطابق token بـ token (ما بيتأثر باختلاف المسافات أو CRLF)، وبيفشل بأمان إذا الدالة تغيّرت.
- **Migration 3:**
  - قيود CHECK **NOT VALID**: الوصف ≤1000 حرف، و`structured_data` ≤32KB للخدمات والطلبات. ما بتأثر على الصفوف الموجودة.
  - trigger بيمنع أكتر من 30 خدمة للمزوّد.

### 4) فلتر الهاتف
- **الفحص:** ثبت من وسائط الـ trigger الحية إن المغطى كان `description` و`structured_data.additional_info` فقط.
- **التعديل:** بـ Migration 4، نفس الدالة الحالية بدون تغيير السلوك، مع إضافة المسارات: service/category/skills/synonyms/location/region/city/area/service_area/delivery_mode (والطلبات كمان).
- **فحص بيانات الإنتاج (قراءة فقط):** 0 من 5 خدمات و0 من 19 طلب كانوا رح يُرفضون.
- **ما بيتأثر:** الصفوف القديمة (الـ trigger بيفحص القيم اللي بتتغير فقط).

## 3. خطوات التطبيق (cmd)

```bat
cd C:\Users\USER\Desktop\subabase-sho\last-sho
git status                       :: لازم يكون نظيف، وعلى security/ai-analysis-rate-limits
tar -xf shobdk-security-patch.zip
git status && git diff           :: راجع التعديلات قبل أي commit
```

**ترتيب النشر المقترح (على staging/branch أول):**
1. طبّق الـ migrations بالترتيب: `supabase db push`. الأول لازم 1 ثم 2 ثم 3 ثم 4.
2. `supabase functions deploy match-service-providers`. الدالة بتشتغل مع الـ DB القديمة والجديدة.
3. دوال `analyze-*` ما انلمست. تذكير: `analyze-service-request` المنشورة نسخة أقدم من `b284937` (بلا فحص schema ولا retry، وبترجع JSON الخام)، وتحققت من هذا بقراءة الكود المنشور. `analyze-provider-service` ما قارنتها حرفياً، لكنها نُشرت بنفس الدقيقة تقريباً فالأرجح نفس الحالة. نشر نسخة الفرع قرار منفصل.

## 4. تدوير مفتاح Gemini (موصى به)

لا دليل على تسريب بسجلات آخر 24 ساعة (ما صار خطأ شبكة)، بس ما قدرت أفحص أقدم.
- ابحث بلوحة Supabase → Logs عن `error sending request` و`key=` بالفترة القديمة إذا ممكن.
- إذا لقيت أو ما قدرت تتأكد: ولّد مفتاح جديد من Google AI Studio، ثم `supabase secrets set GEMINI_API_KEY=...` وألغِ القديم.
- حط حد إنفاق وquota على المفتاح من Google Cloud.

## 5. التوافق: شو بيتغيّر وشو لا

**عقد الـ API ثابت:**
- شكل الطلب والرد نفسه، والمسار القديم (legacy) شغّال.
- جديد: الرد 413 لـ body أكبر من 256KB. للمسارات العادية الحجم بالمئات bytes، وللقديم عشرات KB.

**من جهة التطبيق:**
- عناصر `services` بالـ RPC فيها كل المفاتيح اللي بيقرأها التطبيق: `service, skills, service_area, region, location, additional_info, delivery_mode`. اختبار `fixture/11` بيثبت إن المخرجات للمزوّد العادي ما اختلفت.
- مفاتيح ما بيقرأها التطبيق (مثل `confidence` أو `ai_failed`) ما عادت ترجع.
- `service_area` ككائن ما بيعرضه التطبيق أصلاً (`str(object)` فاضي)، وبقي كما هو.
- ترتيب المطابقة والدرجات ما تغيّرت: بصمة كل الأعمدة غير `services` متطابقة قبل وبعد (`f336c089…`)، والدرجات 130/100/40 نفسها.
- `match_reason` بيظهر دايماً نص غير فاضي لما يتم استبداله (التطبيق بيستخدم `??`).
- نص البرومبت للطلب بقي whitelist: ما عاد يمر `clarification_question` و`confidence`. أثرها على المطابقة معدوم تقريباً.

**ملاحظات UX (بدون تعديل كود):**
- المزوّد اللي بيكتب رقم بحقل جديد ممنوع بيشوف رسالة `PHONE_NUMBER_NOT_ALLOWED` الخام بشاشة إضافة الخدمة، لأن `providerServicesAdapter.ts` بيرجّع `error.message` كما هو. السلوك موجود أصلاً للوصف و`additional_info`. التحسين المقترح لاحقاً: ترجمتها برسالة عربية بالعميل.
- الحد 30 خدمة لكل مزوّد قابل للتعديل بـ Migration 3.

## 6. الاختبارات والنتائج

**Deno (21 اختبار):**
```bat
deno test --no-lock --config supabase/functions/_tests/deno.json -A supabase/functions/_tests/
```
- النتيجة على `index.ts` المعدّل: 21 ناجح.
- **اختبار ضابط:** نفس اختبارات الـ handler على `index.ts` الأصلي (`set MATCH_INDEX_URL=file:///.../index.ts`): تفشل 3 من 4 (تسريب المفتاح، وحدود الحجم، وتصفية الـ reason). الرابع (401 بدون token) بينجح لأنه سليم أصلاً.
- الاختبارات بتستخدم `fetch` مُحاكى بالكامل، ما في أي اتصال حقيقي بـ Supabase أو Gemini.
- لازم Deno 2.x. استخدم `--config` كما هو مكتوب: بدونه Deno بيلتقط `package.json` تبع Expo بجذر الريبو وبيطلب `@types/node` من `node_modules`. أول تشغيل بينزّل حزم npm (`@supabase/supabase-js@2.117.2` وتبعياتها) من registry.npmjs.org.

**SQL (6 اختبارات):**
```bat
:: على DB تجريبي فقط، مو الإنتاج:
psql <url> -f supabase/tests/sql/fixture/local_fixture.sql     :: بيبني الـ fixture
:: طبّق الـ migrations الأربعة، ثم:
set WITH_FIXTURE=1 && bash supabase/tests/sql/run_local.sh <url>
```
- `01` و`02` و`03` بتشتغل على أي DB، لأنها فحص كتالوج ودوال بدون بيانات، وبتنتهي بـ ROLLBACK. لو عندك Supabase محلي (`supabase start`) شغّلها عليه.
- `fixture/10` و`11` و`12` بتزرع بيانات فيصير تشغيلها على الـ fixture فقط.
- **النتائج بالـ sandbox (Postgres 16):**
  - قبل الـ migrations: 6 من 6 فشلوا بالسبب المتوقع بالضبط (مثلاً `requester inserted an arbitrary user as a candidate`، و`hostile provider returned 30 services`، و`structured_data.service was accepted`).
  - بعدها: 6 من 6 نجحوا.
  - الـ rollback أرجع الدالة لنفس بصمتها الأصلية، وفشلت الستة، وإعادة التطبيق نجحت.
  - تطبيق Migration 2 مرتين آمن (بيطبع NOTICE ويتخطى).
  - الباتش اشتغل أيضاً على نسخة من الدالة بمسافات وCRLF مختلفة.
- **قيود:**
  - الـ fixture بسيط: `norm_ar` و`norm_region` و`region_matches` و`jsonb_*` stubs (لا تؤثر على شكل `services`).
  - نصوص `get_provider_candidates` و`contains_phone_number` و`reject_phone_numbers_in_text_columns` منسوخة من الإنتاج، وتأكدت بالـ md5.
  - الإنتاج Postgres 17 والـ sandbox 16 (ما استخدمت امتيازات خاصة بـ 17).

## 7. مشاكل ما عالجتها، وشو يلزم

| الموضوع | ليش | شو يلزم للتحقق |
|---|---|---|
| سقف عام لإنفاق AI وحسابات مجانية | غير مؤكد من الكود | بلوحة Auth: هل تسجيل البريد مفتوح؟ هل Anonymous مفعّل؟ (آخر فحص: 0 مجهول وهوية بريد واحدة). ثم حد إنفاق من Google Cloud. |
| فحص الحساب الموقوف بـ `guard.ts` | منخفض ويحتاج قرار | تحديد RPC اللي بيمثّل "حساب فعّال". |
| `reports`: الـ INSERT بيقبل `status/resolution/...` | خارج المطلوب، منخفض | قرار بحصر الأعمدة وبفحص ملكية الطلب. |
| `get_provider_candidates` بلا rate limit والتطبيق بيناديها مباشرة | الحل يحتاج تعديل بالتطبيق | تغيير `searching.tsx` ليعتمد على الدالة السيرفرية فقط. |
| تلاعب بالترتيب (keyword stuffing/تصنيف مزيّف) | الجزء الحتمي بالـ SQL بيعتمد على نص المزوّد | ما في إصلاح بدون قرار منتج (مراجعة أدمن أو تبليغ). التعديلات هون بتحدّه وما بتلغيه. |
| سجلات أقدم من 24 ساعة | ما قدرت أفحصها | انظر البند 4. |

## 8. Rollback

`supabase/rollback/20261105_rollback_security_patch.sql`: بيعكس الـ migrations الأربعة بترتيب معاكس. **تشغيله بيعيد فتح الثغرات.** جُرّب على الـ sandbox.
