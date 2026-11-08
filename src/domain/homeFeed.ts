// ===============================================================
// شريط الرئيسية: المطلوب والمتوفر الآن (طلبات وعروض خدمات بلا أسماء) ثم تُكمَل القائمة بالتلميحات.
// الأحدث أولاً (الترتيب يأتي من الخادم)، وإذا قلّ العدد عن الحد تُملأ البقية بالتلميحات فلا يبقى الشريط فارغاً.
// ===============================================================

export const HOME_FEED_MAX = 20;

export type FeedEntry = { kind: 'request' | 'offer'; text: string };
export type HomeFeedItem = { kind: 'request' | 'offer' | 'tip'; text: string };

export function buildHomeFeed(
  entries: readonly FeedEntry[],
  tips: readonly string[],
  max: number = HOME_FEED_MAX,
): HomeFeedItem[] {
  const entryItems: HomeFeedItem[] = entries
    .map((entry) => ({ kind: entry.kind, text: entry.text.trim() }))
    .filter((entry) => entry.text.length > 0)
    .slice(0, max);

  const room = Math.max(0, max - entryItems.length);
  const tipItems: HomeFeedItem[] = tips
    .map((tip) => tip.trim())
    .filter((tip) => tip.length > 0)
    .slice(0, room)
    .map((text) => ({ kind: 'tip', text }));

  return [...entryItems, ...tipItems];
}
