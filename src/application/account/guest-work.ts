import { singleWallStudio } from '../../domain/studio/studio-edit';
import type { ProjectDocument } from '../../domain/project/project';

/** Objects with their keys in order, so the same content compares equal however it was stored. */
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
    : value;
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/**
 * Whether a design holds anything the person did: a wardrobe added, a room built or changed (walls, openings, ceiling,
 * fixtures), a reach set. The editor saves a fresh design as no wardrobe and the single starting wall, which is the same
 * rule the welcome uses for "nothing here yet": that is not work, and not worth asking about. Anything else is.
 */
export function hasDesignWork(document: ProjectDocument): boolean {
  if (document.wardrobes.length || document.maxReach !== undefined) return true;
  return !!document.studio && !same(document.studio, singleWallStudio());
}
