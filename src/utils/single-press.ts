// يمنع تكرار التنقل عند الضغط مرتين بسرعة على أزرار فتح المحادثة.
let lastAllowedAt = 0;

/** يسمح بالضغطة الأولى، ويتجاهل أي ضغطة أخرى خلال النافذة المحددة. */
export function allowPress(windowMs = 700): boolean {
  const now = Date.now();
  if (now - lastAllowedAt < windowMs) return false;
  lastAllowedAt = now;
  return true;
}
