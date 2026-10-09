// ===============================================================
// حارس التنقل: يمنع فتح نفس الصفحة مرتين عند الضغط السريع المتتالي.
// يُركَّب مرة واحدة عند تشغيل التطبيق (في src/app/_layout.tsx) ويغطي كل استدعاءات
// router.push / router.navigate / router.replace / router.back في التطبيق كله.
//  - نفس الوجهة خلال SAME_TARGET_WINDOW_MS → يتجاهل الاستدعاء الثاني.
//  - router.back() مرتين خلال BACK_WINDOW_MS → يتجاهل الثاني (حتى لا يرجع صفحتين).
// وجهة مختلفة (مثلاً محادثة ثانية) لا تتأثر.
// للتعطيل بالكامل: احذف استدعاء guardRouter من src/app/_layout.tsx.
// ===============================================================

export const SAME_TARGET_WINDOW_MS = 700;
export const BACK_WINDOW_MS = 400;

type AnyFn = (...args: any[]) => any;
type GuardableRouter = Record<string, any>;

const GUARDED_FLAG = '__navigationGuarded';

function keyOf(href: unknown): string {
  if (typeof href === 'string') return href;
  try {
    return JSON.stringify(href);
  } catch {
    return String(href);
  }
}

export function guardRouter(target: GuardableRouter, now: () => number = Date.now): void {
  if (target[GUARDED_FLAG]) return; // لا نغلّف مرتين (Fast Refresh)
  target[GUARDED_FLAG] = true;

  for (const method of ['push', 'navigate', 'replace'] as const) {
    const original = target[method] as AnyFn | undefined;
    if (typeof original !== 'function') continue;

    let lastKey = '';
    let lastAt = -Infinity;

    target[method] = (href: unknown, ...rest: unknown[]) => {
      const t = now();
      const key = keyOf(href);
      if (key === lastKey && t - lastAt < SAME_TARGET_WINDOW_MS) return;
      lastKey = key;
      lastAt = t;
      return original(href, ...rest);
    };
  }

  const originalBack = target.back as AnyFn | undefined;
  if (typeof originalBack === 'function') {
    let lastBackAt = -Infinity;
    target.back = (...args: unknown[]) => {
      const t = now();
      if (t - lastBackAt < BACK_WINDOW_MS) return;
      lastBackAt = t;
      return originalBack(...args);
    };
  }
}
