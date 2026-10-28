// ===============================================================
// شرح الملف: هذا ملف كود (حالة الاتصال بالإنترنت على مستوى التطبيق).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: isOffline، subscribeNetworkStatus،
// configureNetworkProbe، reportRequestSuccess، reportConnectionFailure،
// isConnectionError، logFetchFailure.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// مراقبة الاتصال بالخادم
// الفكرة: كل طلب يمرّ عبر غلاف fetch في عميل Supabase (انظر supabase.ts)،
// فنسجّل نجاحه أو فشله بسبب الشبكة. عند الفشل يظهر شريط عربي واحد للمستخدم
// (ConnectionBanner) بدل رسائل أخطاء متكررة، ويختفي تلقائياً عند عودة الاتصال.
// هذا الملف لا يغيّر أي بيانات ولا حالة أعمال؛ يكتفي بمراقبة الشبكة.
// ═══════════════════════════════════════════════════════════

/** كل كم نحاول التأكد من عودة الاتصال أثناء الانقطاع. */
const PROBE_INTERVAL_MS = 6000;
/** مهلة المسبار الواحد (لا ننتظر أكثر من ذلك). */
const PROBE_TIMEOUT_MS = 5000;

/** طلبات فشلت بسبب الشبكة ولم يُعوّضها نجاح بعد. */
let failedRequests = 0;
let offline = false;
const listeners = new Set<(offline: boolean) => void>();
let probeTimer: ReturnType<typeof setInterval> | null = null;
let probeTarget: { url: string; apiKey: string } | null = null;

export function isOffline(): boolean {
  return offline;
}

export function subscribeNetworkStatus(listener: (offline: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** يحدّد عنوان الفحص الدوري (يُستدعى مرة واحدة من supabase.ts). */
export function configureNetworkProbe(target: { url: string; apiKey: string }): void {
  probeTarget = target;
}

function setOffline(next: boolean): void {
  if (next === offline) return;
  offline = next;
  if (next) startProbe();
  else stopProbe();
  listeners.forEach((listener) => listener(offline));
}

/** فشل طلب بسبب الشبكة: نعتبر الاتصال منقطعاً حتى يُعوّض. */
export function reportConnectionFailure(): void {
  failedRequests += 1;
  setOffline(true);
}

/**
 * نجاح طلب: لا يُلغي الانقطاع إلا إذا عُوّض كل فشل سابق،
 * فنجاح طلب واحد لا يعني أن بقية الطلبات صارت تعمل.
 */
export function reportRequestSuccess(): void {
  if (failedRequests > 0) failedRequests -= 1;
  if (failedRequests === 0) setOffline(false);
}

/** تأكيد عودة الاتصال من المسبار: نُصفّر العدّاد لأن الخادم صار متاحاً الآن. */
function reportConnectionRestored(): void {
  failedRequests = 0;
  setOffline(false);
}

function startProbe(): void {
  if (probeTimer) return;
  probeTimer = setInterval(() => {
    void probeConnection();
  }, PROBE_INTERVAL_MS);
}

function stopProbe(): void {
  if (!probeTimer) return;
  clearInterval(probeTimer);
  probeTimer = null;
}

/** مسبار خفيف: أي رد من الخادم (حتى 401/404) يعني أن الاتصال عاد. */
async function probeConnection(): Promise<void> {
  const target = probeTarget;
  if (!target) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(target.url, {
      method: 'HEAD',
      headers: { apikey: target.apiKey },
      signal: controller.signal,
    });
    reportConnectionRestored();
  } catch {
    // ما زال منقطعاً: نُبقي الشريط ونعيد المحاولة في الدورة القادمة
  } finally {
    clearTimeout(timer);
  }
}

function toMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

/**
 * هل الفشل سببه انقطاع الشبكة/تعذّر الوصول للخادم؟
 * نُفرّقه عن أخطاء الصلاحيات وقاعدة البيانات حتى لا نُخفيها.
 */
export function isConnectionError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return false;
  const message = toMessage(error);
  if (!message) return false;
  const text = message.toLowerCase();
  // إلغاء مقصود (مهلة/تنقّل) ليس انقطاعاً
  if (text.includes('abort')) return false;
  return (
    text.includes('unable to resolve host') ||
    text.includes('unknownhostexception') ||
    text.includes('no address associated with hostname') ||
    text.includes('network request failed') ||
    text.includes('failed to fetch') ||
    text.includes('fetch failed') ||
    text.includes('network error') ||
    text.includes('networkerror') ||
    text.includes('internet connection appears to be offline') ||
    text.includes('specified hostname could not be found') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('econnrefused') ||
    text.includes('econnreset') ||
    text.includes('enotfound') ||
    text.includes('ehostunreach') ||
    text.includes('enetunreach')
  );
}

/**
 * تسجيل فشل جلب من الخادم: انقطاع الشبكة يُسجَّل تحذيراً قصيراً (بلا تفاصيل
 * Java/الشبكة) لأنّه حالة متوقّعة، وبقية الأخطاء تبقى console.error صريحة.
 */
export function logFetchFailure(scope: string, action: string, error: unknown): void {
  if (isConnectionError(error)) {
    console.warn(`[${scope}] ${action}: تعذّر الوصول للخادم — سيُحدَّث تلقائياً عند عودة الاتصال.`);
    return;
  }
  console.error(`[${scope}] ${action}:`, toMessage(error) ?? 'خطأ غير معروف');
}
