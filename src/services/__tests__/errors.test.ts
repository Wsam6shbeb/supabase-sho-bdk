import { classifyError, getUserMessage, describeError } from '@/services/errors';

jest.mock('@/services/networkStatus', () => ({
  isConnectionError: (error: unknown) => {
    const message = typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';
    return /network request failed|failed to fetch|network error/i.test(message);
  },
}));

describe('centralized user-facing errors', () => {
  it('classifies connection failures without exposing their technical text', () => {
    const error = new Error('Network request failed at SupabaseClient.ts:22');
    expect(classifyError(error)).toBe('network');
    expect(getUserMessage(error, 'load')).toBe('تعذر الاتصال بالإنترنت. تحقق من اتصالك وحاول مرة أخرى.');
    expect(getUserMessage(error, 'load')).not.toContain('SupabaseClient');
  });

  it('classifies timeouts separately', () => {
    expect(classifyError(new Error('request timed out'))).toBe('timeout');
  });

  it('classifies Edge Function fetch failures as network failures', () => {
    const error = new Error('Failed to send a request to the Edge Function');
    error.name = 'FunctionsFetchError';
    expect(classifyError(error)).toBe('network');
  });

  it('classifies Edge Function HTTP permission and server responses', () => {
    const forbidden = Object.assign(new Error('Edge Function failed'), {
      name: 'FunctionsHttpError',
      context: { status: 403 },
    });
    const server = Object.assign(new Error('Edge Function failed'), {
      name: 'FunctionsHttpError',
      context: { status: 503 },
    });
    expect(classifyError(forbidden)).toBe('permission');
    expect(classifyError(server)).toBe('server');
  });

  it('keeps authentication failures distinct and friendly', () => {
    const error = new Error('Invalid login credentials');
    expect(classifyError(error)).toBe('auth');
    expect(getUserMessage(error, 'login')).toBe('تعذر تسجيل الدخول. تحقق من بياناتك وحاول مرة أخرى.');
  });

  it('marks validation and permission errors as non-retryable', () => {
    expect(describeError({ code: '23505', message: 'duplicate key' }).retryable).toBe(false);
    expect(describeError({ code: '42501', message: 'permission denied' }).retryable).toBe(false);
  });

  it('uses a calm fallback for unknown technical exceptions', () => {
    const error = new Error('TypeError: Cannot read property at wallet.tsx:91');
    const info = describeError(error, 'load');
    expect(info.message).toBe('لم نتمكن من تحميل البيانات حالياً.');
    expect(info.message).not.toContain('wallet.tsx');
  });
});
