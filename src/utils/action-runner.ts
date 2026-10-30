// ===============================================================
// منطق "تنفيذ عملية مع إعادة المحاولة" بدون React (ليسهل اختباره).
//
// - لا يبدأ تنفيذاً ثانياً أثناء وجود تنفيذ جارٍ (يمنع الضغط المتكرر والعمليات المكررة).
// - يحفظ مدخلات آخر محاولة فاشلة، و retry() تعيد نفس العملية بنفس المدخلات فعلاً.
// - retry() بعد نجاح العملية لا تفعل شيئاً (لا تكرار لعملية نجحت).
// - لا يبتلع الخطأ: يرجعه لمن استدعى run() ليعرضه، ويبقيه في الحالة.
// ===============================================================

export type ActionStatus = 'idle' | 'running' | 'failed' | 'succeeded';

export interface ActionState {
  status: ActionStatus;
  error: unknown;
}

export type RunResult<R> =
  | { ok: true; value: R }
  | { ok: false; skipped: true }
  | { ok: false; skipped?: false; error: unknown };

export function createActionRunner<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
  onChange?: (state: ActionState) => void,
) {
  let state: ActionState = { status: 'idle', error: null };
  let lastArgs: A | null = null;

  const set = (next: ActionState) => {
    state = next;
    onChange?.(state);
  };

  async function run(...args: A): Promise<RunResult<R>> {
    if (state.status === 'running') return { ok: false, skipped: true };
    lastArgs = args;
    set({ status: 'running', error: null });
    try {
      const value = await action(...args);
      set({ status: 'succeeded', error: null });
      return { ok: true, value };
    } catch (error) {
      set({ status: 'failed', error });
      return { ok: false, error };
    }
  }

  async function retry(): Promise<RunResult<R>> {
    if (state.status !== 'failed' || lastArgs === null) return { ok: false, skipped: true };
    return run(...lastArgs);
  }

  return { run, retry, getState: () => state };
}
