import type { PlannerConfig, PlannerProposal } from '../../domain/planner/wardrobe-planner';

/** Plans Auto design's layouts in a Web Worker (planner-worker.ts), one worker for the page. `planInBackground`
 * returns null where workers are not available (tests, very old browsers): the caller then plans in place. A
 * failed plan resolves to null as well. */
let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, (result: PlannerProposal[] | null) => void>();

function start(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'function' ? new Worker(new URL('./planner-worker.ts', import.meta.url), { type: 'module' }) : null;
  } catch {
    worker = null;
  }
  if (worker) {
    worker.onmessage = (e: MessageEvent<{ id: number; result: PlannerProposal[] | null }>) => {
      pending.get(e.data.id)?.(e.data.result);
      pending.delete(e.data.id);
    };
    // A worker that cannot run: every waiting plan, and every later one, is planned in place.
    worker.onerror = () => {
      worker = null;
      pending.forEach(resolve => resolve(null));
      pending.clear();
    };
  }
  return worker;
}

export function planInBackground(cfg: PlannerConfig): Promise<PlannerProposal[] | null> | null {
  const w = start();
  if (!w) return null;
  const id = ++nextId;
  return new Promise(resolve => {
    pending.set(id, resolve);
    w.postMessage({ id, cfg });
  });
}
