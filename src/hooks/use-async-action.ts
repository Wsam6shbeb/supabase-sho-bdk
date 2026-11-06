// ===============================================================
// useAsyncAction — تنفيذ عملية غير متزامنة مع: حالة تحميل، منع تكرار، ورسالة خطأ مناسبة،
// وإعادة محاولة تنفذ نفس العملية بنفس المدخلات.
//
//   const send = useAsyncAction(sendMessage, { context: 'sendMessage' });
//   await send.run(text);                 // يعرض send.loading
//   send.error?.message                   // رسالة عربية جاهزة (بلا تفاصيل تقنية)
//   send.canRetry && send.retry()         // يعيد تنفيذ send(text) فعلاً
// ===============================================================

import { describeError, type ErrorContext, type ErrorInfo } from '@/services/errors';
import { logError } from '@/services/logger';
import { createActionRunner, type ActionState, type RunResult } from '@/utils/action-runner';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Options {
  /** اسم العملية للسجل (للمطوّر فقط). */
  operation?: string;
  context?: ErrorContext;
}

export function useAsyncAction<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
  { operation = 'action', context = 'generic' }: Options = {},
) {
  const [state, setState] = useState<ActionState>({ status: 'idle', error: null });
  const mounted = useRef(true);
  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runner = useMemo(
    () =>
      createActionRunner<A, R>(
        (...args) => actionRef.current(...args),
        (next) => {
          if (mounted.current) setState(next);
        },
      ),
    [],
  );

  const run = useCallback(
    async (...args: A): Promise<RunResult<R>> => {
      const result = await runner.run(...args);
      if (!result.ok && !result.skipped) logError(`[${operation}] فشلت العملية`, result.error);
      return result;
    },
    [runner, operation],
  );

  const retry = useCallback(async (): Promise<RunResult<R>> => {
    const result = await runner.retry();
    if (!result.ok && !result.skipped) logError(`[${operation}] فشلت إعادة المحاولة`, result.error);
    return result;
  }, [runner, operation]);

  const error: ErrorInfo | null = state.status === 'failed' ? describeError(state.error, context) : null;

  return {
    run,
    retry,
    loading: state.status === 'running',
    error,
    canRetry: state.status === 'failed' && (error?.retryable ?? false),
  };
}
