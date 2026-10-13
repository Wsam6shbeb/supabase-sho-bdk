export interface SupportContacts {
  email: string;
  phone: string;
}

const DEFAULT_SUPPORT_EMAIL = 'shobdkhelpcenter@gmail.com';
const SUPPORT_URL = 'https://sho-bdk-dashboard.pages.dev/api/public-support';

export async function getSupportContacts(): Promise<SupportContacts> {
  try {
    const response = await fetch(SUPPORT_URL);
    if (!response.ok) throw new Error('Support contacts request failed');

    const data = await response.json();
    return {
      email:
        typeof data.supportEmail === 'string' && data.supportEmail.trim()
          ? data.supportEmail.trim()
          : DEFAULT_SUPPORT_EMAIL,
      phone: typeof data.supportPhone === 'string' ? data.supportPhone.trim() : '',
    };
  } catch {
    return { email: DEFAULT_SUPPORT_EMAIL, phone: '' };
  }
}
