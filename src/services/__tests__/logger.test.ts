import { sanitize } from '@/services/logger';

describe('developer log sanitization', () => {
  it('redacts secrets and personal fields in structured values', () => {
    const result = sanitize({
      email: 'person@example.com',
      phone: '+963955123456',
      user_id: 'user-private-id',
      address: 'Private street',
      description: 'User supplied text',
      access_token: 'secret-token',
      operation: 'sendMessage',
    }) as Record<string, unknown>;

    expect(result.email).toBe('[REDACTED]');
    expect(result.phone).toBe('[REDACTED]');
    expect(result.user_id).toBe('[REDACTED]');
    expect(result.address).toBe('[REDACTED]');
    expect(result.description).toBe('[REDACTED]');
    expect(result.access_token).toBe('[REDACTED]');
    expect(result.operation).toBe('sendMessage');
  });

  it('preserves the complete stack trace while redacting sensitive values', () => {
    const error = new Error('failure');
    error.stack = Array.from({ length: 16 }, (_, index) => `frame-${index}`).join('\\n');
    const result = sanitize(error) as { stack?: string };
    expect(result.stack).toContain('frame-15');
  });

  it('redacts tokens, email addresses, and phone numbers inside strings', () => {
    const value = sanitize('Bearer abc.def token=private person@example.com +963955123456');
    expect(value).not.toContain('abc.def');
    expect(value).not.toContain('person@example.com');
    expect(value).not.toContain('+963955123456');
  });
});
