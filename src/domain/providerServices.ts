// تحويل structured_data الخاص بخدمات مقدم الخدمة إلى مهارات وتفاصيل للعرض.
import type { ProviderServiceInfo } from '@/types/orders';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function buildProviderServiceInfo(rawServices: unknown[]): {
  skills: string[];
  services: ProviderServiceInfo[];
} {
  const skillSet = new Set<string>();
  const services: ProviderServiceInfo[] = [];

  for (const raw of rawServices ?? []) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const d = raw as Record<string, unknown>;

    const service = str(d.service);
    const skills = Array.isArray(d.skills)
      ? d.skills.map(str).filter(Boolean)
      : [];

    skills.forEach((x) => skillSet.add(x));
    // إذا لم يُدخل المزوّد مهارات، نعرض اسم الخدمة نفسه كمهارة.
    if (skills.length === 0 && service) skillSet.add(service);

    services.push({
      service,
      skills,
      service_area: str(d.service_area) || str(d.region) || str(d.location) || undefined,
      additional_info: str(d.additional_info) || undefined,
      delivery_mode: str(d.delivery_mode) || undefined,
    });
  }

  return { skills: Array.from(skillSet), services };
}
