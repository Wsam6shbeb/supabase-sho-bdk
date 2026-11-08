import { buildHomeFeed, HOME_FEED_MAX, type FeedEntry } from '../homeFeed';

const req = (text: string): FeedEntry => ({ kind: 'request', text });
const offer = (text: string): FeedEntry => ({ kind: 'offer', text });

describe('buildHomeFeed', () => {
  const tips = ['نصيحة 1', 'نصيحة 2', 'نصيحة 3'];

  it('keeps the server order (newest first) mixing requests and offers, then tips', () => {
    const feed = buildHomeFeed([offer('تعقيب معاملات'), req('بدي سباك'), offer('سيارة أجرة')], tips);
    expect(feed.map((item) => item.kind)).toEqual(['offer', 'request', 'offer', 'tip', 'tip', 'tip']);
    expect(feed[0].text).toBe('تعقيب معاملات');
  });

  it('shows only tips when there is nothing else (never empty)', () => {
    const feed = buildHomeFeed([], tips);
    expect(feed).toHaveLength(3);
    expect(feed.every((item) => item.kind === 'tip')).toBe(true);
  });

  it('shows no tips at all when there are 20 or more entries, dropping the oldest beyond the limit', () => {
    const many = Array.from({ length: 25 }, (_, i) => req(`طلب ${i}`));
    const feed = buildHomeFeed(many, tips);
    expect(feed).toHaveLength(HOME_FEED_MAX);
    expect(feed.every((item) => item.kind === 'request')).toBe(true);
    expect(feed[0].text).toBe('طلب 0');
    expect(feed[19].text).toBe('طلب 19');
  });

  it('tops up with tips only for the remaining room', () => {
    const manyTips = Array.from({ length: 30 }, (_, i) => `نصيحة ${i}`);
    const feed = buildHomeFeed([req('a'), offer('b'), req('c')], manyTips);
    expect(feed).toHaveLength(HOME_FEED_MAX);
    expect(feed.filter((item) => item.kind === 'tip')).toHaveLength(HOME_FEED_MAX - 3);
  });

  it('shows what is available even if there are fewer than 20 in total', () => {
    expect(buildHomeFeed([req('a'), req('b'), offer('c')], tips)).toHaveLength(6);
  });

  it('ignores blank entries and trims text', () => {
    const feed = buildHomeFeed([req('  بدي سباك  '), req('   ')], ['  ', 'نصيحة']);
    expect(feed).toEqual([
      { kind: 'request', text: 'بدي سباك' },
      { kind: 'tip', text: 'نصيحة' },
    ]);
  });
});
