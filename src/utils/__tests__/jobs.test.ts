import {
  buildContactUrl,
  daysLeft,
  expiryLabel,
  mergeSkills,
  normalizeContactValue,
  normalizeDigits,
  parseSkillInput,
  sanitizeFilterText,
  timeAgoAr,
  validateContact,
} from '@/utils/jobs';

describe('job contact helpers', () => {
  it('converts Arabic-Indic digits and strips separators from phone numbers', () => {
    expect(normalizeDigits('٠٩٣٩٧٤٠٠٤٢')).toBe('0939740042');
    expect(normalizeContactValue('phone', '٠٩٣٩ ٧٤٠-٠٤٢')).toBe('0939740042');
    expect(normalizeContactValue('whatsapp', '+963 (939) 740.042')).toBe('+963939740042');
  });

  it('fixes link scheme case and adds https when missing', () => {
    expect(normalizeContactValue('link', 'Https://example.com/x')).toBe('https://example.com/x');
    expect(normalizeContactValue('link', 'facebook.com/page')).toBe('https://facebook.com/page');
  });

  it('validates each contact type like the database constraint', () => {
    expect(validateContact('phone', '0939740042')).toBeNull();
    expect(validateContact('phone', '123')).not.toBeNull();
    expect(validateContact('whatsapp', '+963939740042')).toBeNull();
    expect(validateContact('email', 'a@b.co')).toBeNull();
    expect(validateContact('email', 'not-an-email')).not.toBeNull();
    expect(validateContact('link', 'https://example.com')).toBeNull();
    expect(validateContact('link', 'javascript:alert(1)')).not.toBeNull();
    expect(validateContact('phone', '')).not.toBeNull();
  });

  it('builds contact urls, converting local Syrian numbers for WhatsApp', () => {
    expect(buildContactUrl('phone', '0939740042')).toBe('tel:0939740042');
    expect(buildContactUrl('whatsapp', '0939740042')).toBe('https://wa.me/963939740042');
    expect(buildContactUrl('whatsapp', '+963939740042')).toBe('https://wa.me/963939740042');
    expect(buildContactUrl('whatsapp', '00963939740042')).toBe('https://wa.me/963939740042');
    expect(buildContactUrl('email', 'a@b.co')).toBe('mailto:a@b.co');
    expect(buildContactUrl('link', 'https://example.com')).toBe('https://example.com');
  });
});

describe('job skills helpers', () => {
  it('splits on Latin and Arabic commas and trims', () => {
    expect(parseSkillInput('محاسبة، إكسل,  خدمة  عملاء ')).toEqual(['محاسبة', 'إكسل', 'خدمة عملاء']);
  });

  it('merges without duplicates and respects the maximum', () => {
    expect(mergeSkills(['محاسبة'], 'محاسبة، إكسل')).toEqual(['محاسبة', 'إكسل']);
    const many = Array.from({ length: 10 }, (_, i) => `s${i}`);
    expect(mergeSkills(many, 'extra')).toHaveLength(10);
  });
});

describe('job filter and date helpers', () => {
  it('removes characters that could break a PostgREST filter', () => {
    expect(sanitizeFilterText('a,b(c)"d"%_ e')).toBe('a b c d e');
  });

  it('formats relative time in Arabic', () => {
    const now = new Date('2026-11-12T12:00:00Z').getTime();
    expect(timeAgoAr('2026-11-12T11:59:40Z', now)).toBe('الآن');
    expect(timeAgoAr('2026-11-12T11:30:00Z', now)).toBe('قبل 30 دقيقة');
    expect(timeAgoAr('2026-11-12T09:00:00Z', now)).toBe('قبل 3 ساعة');
    expect(timeAgoAr('2026-11-10T12:00:00Z', now)).toBe('قبل 2 يوم');
  });

  it('describes expiry', () => {
    const now = new Date('2026-11-12T12:00:00Z').getTime();
    expect(daysLeft('2026-11-15T12:00:00Z', now)).toBe(3);
    expect(expiryLabel('2026-11-15T12:00:00Z', now)).toBe('تنتهي بعد 3 يوم');
    expect(expiryLabel('2026-11-12T20:00:00Z', now)).toBe('تنتهي بعد 1 يوم');
    expect(expiryLabel('2026-11-10T12:00:00Z', now)).toBe('منتهية');
  });
});
