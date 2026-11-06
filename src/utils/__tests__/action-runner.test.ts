import { createActionRunner } from '@/utils/action-runner';

describe('createActionRunner', () => {
  it('retries a failed operation with the exact same input', async () => {
    const action = jest.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('sent');
    const runner = createActionRunner(action);
    const input = { text: 'رسالة محفوظة', clientKey: 'stable-key' };

    const first = await runner.run(input);
    expect(first.ok).toBe(false);
    expect(runner.getState().status).toBe('failed');

    const retried = await runner.retry();
    expect(retried).toEqual({ ok: true, value: 'sent' });
    expect(action).toHaveBeenNthCalledWith(1, input);
    expect(action).toHaveBeenNthCalledWith(2, input);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('skips another call while an operation is already running', async () => {
    let finish!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const action = jest.fn((_input: string) => pending);
    const runner = createActionRunner(action);

    const first = runner.run('same operation');
    const second = await runner.run('duplicate operation');

    expect(second).toEqual({ ok: false, skipped: true });
    expect(action).toHaveBeenCalledTimes(1);

    finish('done');
    await first;
    expect(runner.getState().status).toBe('succeeded');
  });

  it('does not repeat an operation after it has succeeded', async () => {
    const action = jest.fn(async (_input: string) => 'done');
    const runner = createActionRunner(action);

    await runner.run('request');
    const retry = await runner.retry();

    expect(retry).toEqual({ ok: false, skipped: true });
    expect(action).toHaveBeenCalledTimes(1);
  });
});
