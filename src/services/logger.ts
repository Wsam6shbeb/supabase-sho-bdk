// ===============================================================
// سجل المطوّر الموحّد.
//
// - الواجهة مطابقة لـ console.error / console.warn (دالة بعدد متغيّر من المعاملات)،
//   فاستبدالها بالمشروع آلي وآمن (انظر scripts/migrate-console-logging.mjs).
// - يطبع بـ console.log حتى لا يظهر LogBox أحمر (ERROR + Call Stack) على الجهاز أثناء التطوير؛
//   التفاصيل الكاملة تبقى في تيرمنال Metro.
// - لا يطبع شيئاً في نسخة الإصدار (release).
// - يُخفي المفاتيح والرموز والإيميلات والأرقام ونصوص المستخدم الحرة قبل الطباعة.
// - لا يستورد أي ملف آخر من المشروع (ليستعمله أي ملف بلا دورات استيراد).
// ===============================================================

type Level = 'ERROR' | 'WARN' | 'INFO';

const MAX_STRING = 1000;
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;
const MAX_STACK_LINES = 10;

/** مفاتيح كائنات تحمل أسراراً أو بيانات شخصية أو نصوصاً حرة للمستخدم. */
const SENSITIVE_KEY =
  /^(password|pass|passwd|secret|token|authorization|apikey|api_key|api-key|cookie|set-cookie|session|jwt|bearer|email|phone|mobile|full_name|raw_text|description|body|content|comment|additional_info|id_document_url|selfie_url|avatar_url|p_token|push_token|expo_push_token|p_phone|p_body|p_email)$|(_token|_key|_secret|_password)$/i;

const PATTERNS: Array<[RegExp, string]> = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[JWT]'],
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]'],
  [/Expo(?:nent)?PushToken\[[^\]]+\]/g, '[PUSH_TOKEN]'],
  [/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '[KEY]'],
  [/\b(apikey|api_key|access_token|refresh_token|token|key)=([^&\s"']+)/gi, '$1=[REDACTED]'],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]'],
  [/(?:\+|00)?963[\s-]?\d{8,9}\b/g, '[PHONE]'],
  [/(?<![\w-])09\d{8}(?![\w-])/g, '[PHONE]'],
  [/\+\d{10,15}\b/g, '[PHONE]'],
];

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}

export function sanitizeString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  if (out.length > MAX_STRING) out = `${out.slice(0, MAX_STRING)}…[truncated ${out.length - MAX_STRING}]`;
  return out;
}

function describeResponseLike(value: object): Record<string, unknown> | null {
  const v = value as { status?: unknown; statusText?: unknown; url?: unknown };
  if (typeof v.status !== 'number' || typeof v.statusText !== 'string') return null;
  const url = typeof v.url === 'string' ? sanitizeString(v.url.split('?')[0]) : undefined;
  return { status: v.status, statusText: v.statusText, ...(url ? { url } : {}) };
}

function describeError(error: Error, seen: WeakSet<object>, depth: number): Record<string, unknown> {
  const extra = error as Error & { code?: unknown; status?: unknown; details?: unknown; hint?: unknown; context?: unknown; cause?: unknown };
  const out: Record<string, unknown> = {
    type: error.name,
    message: sanitizeString(error.message ?? ''),
  };
  if (extra.code !== undefined) out.code = sanitize(extra.code, seen, depth + 1);
  if (extra.status !== undefined) out.status = sanitize(extra.status, seen, depth + 1);
  if (extra.details !== undefined) out.details = sanitize(extra.details, seen, depth + 1);
  if (extra.hint !== undefined) out.hint = sanitize(extra.hint, seen, depth + 1);
  // FunctionsHttpError.context هو Response: نسجّل حالته فقط
  if (extra.context !== undefined) out.response = sanitize(extra.context, seen, depth + 1);
  if (extra.cause !== undefined) out.cause = sanitize(extra.cause, seen, depth + 1);
  if (error.stack) {
    out.stack = sanitizeString(error.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n'));
  }
  return out;
}

export function sanitize(value: unknown, seen: WeakSet<object> = new WeakSet(), depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;

  const obj = value as object;
  if (seen.has(obj)) return '[Circular]';
  if (depth >= MAX_DEPTH) return '[MaxDepth]';
  seen.add(obj);

  if (obj instanceof Error) return describeError(obj, seen, depth);
  const response = describeResponseLike(obj);
  if (response) return response;

  if (Array.isArray(obj)) {
    const items = obj.slice(0, MAX_ITEMS).map((item) => sanitize(item, seen, depth + 1));
    if (obj.length > MAX_ITEMS) items.push(`[+${obj.length - MAX_ITEMS} more]`);
    return items;
  }

  const out: Record<string, unknown> = {};
  let count = 0;
  for (const key of Object.keys(obj)) {
    if (count++ >= MAX_ITEMS) {
      out['…'] = `[+${Object.keys(obj).length - MAX_ITEMS} more keys]`;
      break;
    }
    out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitize((obj as Record<string, unknown>)[key], seen, depth + 1);
  }
  return out;
}

function emit(level: Level, args: unknown[]): void {
  if (!isDev()) return;
  try {
    const [first, ...rest] = args;
    const head = typeof first === 'string' ? sanitizeString(first) : JSON.stringify(sanitize(first));
    // console.log عمداً: console.error/warn تُظهر LogBox على الجهاز أثناء التطوير
    console.log(`[${level}] ${head}`, ...rest.map((item) => sanitize(item)));
  } catch {
    // السجل لا يجوز أن يكسر التطبيق أبداً
  }
}

/** مكافئ console.error: خطأ غير متوقع أو فشل عملية. */
export function logError(...args: unknown[]): void {
  emit('ERROR', args);
}

/** مكافئ console.warn: حالة متوقعة أو تنبيه للمطوّر. */
export function logWarn(...args: unknown[]): void {
  emit('WARN', args);
}

export function logInfo(...args: unknown[]): void {
  emit('INFO', args);
}
