import type { DrawingInput, DrawingPiece } from '../drawings/room-pieces';
import { fitting } from '../wardrobe/fittings';
import type { EditorDesign } from '../wardrobe/editor-design';

/**
 * What changed between two versions of a scene, in a carpenter's words: pieces added, removed, moved or resized, bays
 * added or removed, fittings added or removed, finishes, doors, construction, shape and the room. It reads two drawing
 * inputs (the engine's view of a scene), so it serves the change history, revision notes on drawings and analytics alike.
 */

export type ChangeKind = 'added' | 'removed' | 'moved' | 'resized' | 'bays' | 'interior' | 'finish' | 'doors' | 'construction' | 'shape' | 'room';

export interface SceneChange {
  readonly kind: ChangeKind;
  /** The piece's scene id and name; absent for the room. */
  readonly piece?: number | undefined;
  readonly name?: string | undefined;
  readonly text: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const cm = (v: number) => Math.round(v * 10) / 10 + ' cm';

/** How many of each fitting kind a design has, by its registry name. */
function fittingCounts(d: EditorDesign): Map<string, number> {
  const counts = new Map<string, number>();
  for (const bay of d.secs.slice(0, d.n)) for (const it of bay ?? []) {
    const name = fitting(it.k)?.name ?? it.k;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function interior(a: EditorDesign, b: EditorDesign): string | null {
  const before = fittingCounts(a), after = fittingCounts(b), parts: string[] = [];
  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const delta = (after.get(name) ?? 0) - (before.get(name) ?? 0);
    if (delta) parts.push((delta > 0 ? '+' : '−') + Math.abs(delta) + ' ' + name.toLowerCase());
  }
  if (parts.length) return parts.join(', ');
  return same(a.secs.slice(0, a.n), b.secs.slice(0, b.n)) && same(a.dividers, b.dividers) ? null : 'fittings rearranged';
}

function pieceChanges(a: DrawingPiece, b: DrawingPiece): SceneChange[] {
  const at = { piece: b.id, name: b.name }, d0 = a.design, d1 = b.design, out: SceneChange[] = [];
  if (a.x !== b.x || a.z !== b.z || a.y !== b.y || a.angle !== b.angle) out.push({ kind: 'moved', ...at, text: b.name + ' moved' });
  if (d0.w !== d1.w || d0.h !== d1.h || d0.d !== d1.d) {
    const sizes = (['w', 'h', 'd'] as const).filter(k => d0[k] !== d1[k]).map(k => ({ w: 'width', h: 'height', d: 'depth' })[k] + ' ' + cm(d0[k]) + ' → ' + cm(d1[k]));
    out.push({ kind: 'resized', ...at, text: b.name + ': ' + sizes.join(', ') });
  }
  if (d0.n !== d1.n) out.push({ kind: 'bays', ...at, text: b.name + ': ' + d0.n + ' → ' + d1.n + ' bays' });
  else if (!same(d0.wt.slice(0, d0.n), d1.wt.slice(0, d1.n))) out.push({ kind: 'bays', ...at, text: b.name + ': bay widths changed' });
  const inside = interior(d0, d1);
  if (inside) out.push({ kind: 'interior', ...at, text: b.name + ': ' + inside });
  if (d0.fin !== d1.fin || !same(d0.materials, d1.materials)) out.push({ kind: 'finish', ...at, text: b.name + ': finish changed' });
  if (d0.doors !== d1.doors || !same(d0.fronts, d1.fronts)) out.push({ kind: 'doors', ...at, text: b.name + ': doors ' + (d0.doors === d1.doors ? 'changed' : d0.doors + ' → ' + d1.doors) });
  if (!same(d0.construction, d1.construction)) out.push({ kind: 'construction', ...at, text: b.name + ': construction changed' });
  if (!same(d0.shape, d1.shape)) out.push({ kind: 'shape', ...at, text: b.name + ': shape changed' });
  return out;
}

/** Every change from `before` to `after`, pieces in the order of `after` (removed ones last), then the room. */
export function diffScenes(before: DrawingInput, after: DrawingInput): SceneChange[] {
  const old = new Map(before.pieces.map(p => [p.id, p])), next = new Set(after.pieces.map(p => p.id)), out: SceneChange[] = [];
  for (const p of after.pieces) {
    const was = old.get(p.id);
    out.push(...(was ? pieceChanges(was, p) : [{ kind: 'added' as const, piece: p.id, name: p.name, text: p.name + ' added' }]));
  }
  for (const p of before.pieces) if (!next.has(p.id)) out.push({ kind: 'removed', piece: p.id, name: p.name, text: p.name + ' removed' });
  if (!same(before.studio, after.studio)) out.push({ kind: 'room', text: before.studio && after.studio ? 'Room changed' : after.studio ? 'Room added' : 'Room removed' });
  return out;
}
