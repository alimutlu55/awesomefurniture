import type { DrawingInput } from '../../domain/drawings/room-pieces';
import type { AnnotationOffset } from './annotation-layout';

/** Positions belong to this geometry snapshot, so another design or moved geometry cannot inherit stale leaders. */
export function annotationStore(input: DrawingInput, storage: Storage | undefined) {
  const source = JSON.stringify(input, (key, value) => ['sel', 'item', 'divider', 'space', 'open', 'proposal'].includes(key) ? undefined : value); let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  const key = 'wardrobe-drawing-labels-v1:' + (hash >>> 0).toString(16), offsets: Record<string, AnnotationOffset> = Object.create(null);
  try {
    const parsed = JSON.parse(storage?.getItem(key) ?? '{}') as Record<string, AnnotationOffset>;
    for (const [k, p] of Object.entries(parsed)) if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 1000 && Math.abs(p.y) < 1000) offsets[k] = p;
  } catch { /* Browser recovery is optional; the live drawing remains usable. */ }
  return { offsets, save() { try { storage?.setItem(key, JSON.stringify(offsets)); return !!storage; } catch { return false; } } };
}
