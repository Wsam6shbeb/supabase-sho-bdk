jest.mock('@/services/logger', () => ({ logError: jest.fn() }));
jest.mock('@/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { Platform } from 'react-native';
import { invokeGeminiWithRetry } from '@/services/geminiRetry';
import { supabase } from '@/services/supabase';

const rateLimitError = {
  context: {
    status: 429,
    clone: () => ({ json: async () => ({ code: 'GEMINI_RATE_LIMITED' }) }),
  },
};

describe('Gemini rate-limit retry helper', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries at 20-second intervals and stops immediately after success', async () => {
    const invoke = jest.fn()
      .mockResolvedValueOnce({ data: null, error: rateLimitError })
      .mockResolvedValueOnce({ data: { structured_data: { service: 'تصليح' } }, error: null });
    const onRetry = jest.fn();

    const resultPromise = invokeGeminiWithRetry('analyze_service_request', invoke, onRetry);
    await jest.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ structured_data: { service: 'تصليح' } });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('preserves one short retry for a thrown transient provider-network error', async () => {
    const invoke = jest.fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ data: { structured_data: { service: 'تصليح' } }, error: null });

    const resultPromise = invokeGeminiWithRetry('analyze_provider_service', invoke);
    await jest.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ structured_data: { service: 'تصليح' } });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('logs one safe operational record after the initial call and three retries fail', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: null, error: rateLimitError });
    const onRetry = jest.fn();

    const resultPromise = invokeGeminiWithRetry('analyze_provider_service', invoke, onRetry);
    await jest.runAllTimersAsync();

    await expect(resultPromise).resolves.toBeNull();
    expect(invoke).toHaveBeenCalledTimes(4);
    expect(onRetry).toHaveBeenCalledTimes(3);
    expect(supabase.from).toHaveBeenCalledWith('app_error_log');
    const insert = (supabase.from as jest.Mock).mock.results[0].value.insert;
    expect(insert).toHaveBeenCalledWith({
      operation: 'analyze_provider_service',
      error_code: 'GEMINI_RATE_LIMITED',
      http_status: 429,
      attempt_count: 4,
      platform: Platform.OS,
    });
  });

  it('does not retry a different 429 response such as the app user rate limit', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 429,
          clone: () => ({ json: async () => ({ code: 'USER_RATE_LIMITED' }) }),
        },
      },
    });

    const result = await invokeGeminiWithRetry('analyze_service_request', invoke);

    expect(result).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
