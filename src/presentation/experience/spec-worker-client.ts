import type { DesignSpec } from '../../domain/spec/design-spec';
import { buildFromSpec, type SpecBuild } from '../../application/spec/build-from-spec';

/** Builds design specs in a Web Worker (spec-worker.ts), one worker for the page, each spec once: asking again
 * for a spec already built (or being built) answers from memory, so the welcome can build ahead while a person
 * is still choosing. Without workers (tests, old browsers) it builds in place, a moment later. */
let worker: Worker | null | undefined, nextId = 0;
const pending = new Map<number, (result: SpecBuild | null) => void>(), built = new Map<string, Promise<SpecBuild | null>>();

function start(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'function' ? new Worker(new URL('./spec-worker.ts', import.meta.url), { type: 'module' }) : null;
  } catch {
    worker = null;
  }
  if (worker) {
    worker.onmessage = (e: MessageEvent<{ id: number; result: SpecBuild | null }>) => { pending.get(e.data.id)?.(e.data.result); pending.delete(e.data.id); };
    worker.onerror = () => { worker = null; pending.forEach(resolve => resolve(null)); pending.clear(); built.clear(); };
  }
  return worker;
}

export function buildInBackground(spec: DesignSpec): Promise<SpecBuild | null> {
  const key = JSON.stringify(spec), known = built.get(key);
  if (known) return known;
  const w = start();
  const result = w
    ? new Promise<SpecBuild | null>(resolve => { const id = ++nextId; pending.set(id, resolve); w.postMessage({ id, spec }); })
    : new Promise<SpecBuild | null>(resolve => setTimeout(() => { try { resolve(buildFromSpec(spec, 'welcome')); } catch { resolve(null); } }, 30));
  built.set(key, result);
  // A few recent builds are kept: a person going back and forth between choices is answered at once.
  if (built.size > 12) built.delete(built.keys().next().value!);
  return result;
}
