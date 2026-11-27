/**
 * Furnishing edits. Each takes a studio and returns the edited copy, or null when the edit does not apply. They do not
 * validate: the caller checks studioProblems() and refuses an invalid result with its reason. Centimetres, degrees.
 */
import { nextId } from '../studio';
import type { Studio, StudioFurnishing } from '../studio';
import type { Pose } from '../studio-placement';
import { furnishingType, startFurnishingType } from './furnishing-kinds';
import { furnishingPoint } from './furnishing-place';

const round = (n: number) => Math.round(n * 10) / 10;
const turn = (angle: number) => round(((angle % 360) + 360) % 360);
const withFurnishings = (studio: Studio, furnishings: readonly StudioFurnishing[]): Studio => {
  if (furnishings.length) return { ...studio, furnishings };
  const { furnishings: _none, ...rest } = studio;
  return rest;
};
const swap = (studio: Studio, id: string, change: (f: StudioFurnishing) => StudioFurnishing | null) => {
  const f = studio.furnishings?.find(x => x.id === id), next = f && change(f);
  return next ? withFurnishings(studio, studio.furnishings!.map(x => x.id === id ? next : x)) : null;
};
const posed = (f: StudioFurnishing, pose: Pose): StudioFurnishing => ({ ...f, x: round(pose.x), z: round(pose.z), angle: turn(pose.angle) });

/** Adds a furnishing of `kind` at `pose`, at its type's usual size (its kind's first type unless `type` says). Its id is
 * the last furnishing's. */
export function addFurnishing(studio: Studio, kind: string, pose: Pose, type?: string): Studio | null {
  const t = type ? furnishingType(kind, type) : startFurnishingType(kind);
  if (!t) return null;
  const used = [...studio.corners, ...studio.walls, ...studio.openings, ...studio.ceilings ?? [], ...studio.fixtures ?? [], ...studio.furnishings ?? []];
  const f: StudioFurnishing = { id: nextId('n', used), kind, type: t.id, x: 0, z: 0, angle: 0, ...t.size };
  return withFurnishings(studio, [...studio.furnishings ?? [], posed(f, pose)]);
}

/** A copy of it at `pose`. Its id is the last furnishing's. */
export function duplicateFurnishing(studio: Studio, id: string, pose: Pose): Studio | null {
  const f = studio.furnishings?.find(x => x.id === id);
  if (!f) return null;
  const used = [...studio.corners, ...studio.walls, ...studio.openings, ...studio.ceilings ?? [], ...studio.fixtures ?? [], ...studio.furnishings!];
  return withFurnishings(studio, [...studio.furnishings!, posed({ ...f, id: nextId('n', used) }, pose)]);
}

/** Moves it: its middle to `pose`'s and its turn to `pose`'s. */
export const moveFurnishing = (studio: Studio, id: string, pose: Pose) => swap(studio, id, f => posed(f, pose));

/** Turns it about its middle to `angle` degrees. */
export const turnFurnishing = (studio: Studio, id: string, angle: number) => swap(studio, id, f => ({ ...f, angle: turn(angle) }));

/** Sets its width, depth or height. Width grows from its middle; depth from its back, so a bed against a wall stays there. */
export function setFurnishingSize(studio: Studio, id: string, size: Partial<Pick<StudioFurnishing, 'width' | 'depth' | 'height'>>): Studio | null {
  return swap(studio, id, f => {
    const depth = size.depth === undefined ? f.depth : round(size.depth), at = furnishingPoint(f, 0, (depth - f.depth) / 2);
    return { ...f, ...size.width !== undefined ? { width: round(size.width) } : {}, ...size.height !== undefined ? { height: round(size.height) } : {},
      depth, x: round(at.x), z: round(at.z) };
  });
}

/** Changes its type and takes that type's size, its back kept where it is (a single bed becomes a king against the same wall). */
export function setFurnishingType(studio: Studio, id: string, type: string): Studio | null {
  const f = studio.furnishings?.find(x => x.id === id), t = f && furnishingType(f.kind, type);
  if (!f || !t) return null;
  if (t.id === f.type) return studio;
  const sized = setFurnishingSize(studio, id, t.size);
  return sized && swap(sized, id, x => ({ ...x, type: t.id }));
}

/** Sets its fabric or wood. The first finish of a group is stored as absent. */
export function setFurnishingLook(studio: Studio, id: string, look: Partial<Pick<StudioFurnishing, 'fabric' | 'wood'>>): Studio | null {
  return swap(studio, id, f => {
    const next: Record<string, unknown> = { ...f, ...look };
    for (const [k, v] of Object.entries(look)) if (v === undefined) delete next[k];
    return next as unknown as StudioFurnishing;
  });
}

export function removeFurnishing(studio: Studio, id: string): Studio | null {
  return studio.furnishings?.some(f => f.id === id) ? withFurnishings(studio, studio.furnishings.filter(f => f.id !== id)) : null;
}
