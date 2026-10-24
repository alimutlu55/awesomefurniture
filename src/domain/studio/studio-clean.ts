/**
 * Makes a room buildable again when its stored shapes carry points that are one point in fact (two corners the
 * same place, from rounding in an old edit). A point that meets its neighbour adds no edge, so it goes; an outline
 * left with fewer than three corners is no outline at all, and a ceiling left with no underside is dropped. Nothing
 * else changes, so a room that was already valid comes back exactly as it was.
 */
import { COINCIDENT, type BoundaryPoint } from '../geometry/boundary';
import type { Studio, StudioCeiling, StudioWall } from './studio';

const near = (a: BoundaryPoint, b: BoundaryPoint) => Math.hypot(a.t - b.t, a.y - b.y) <= COINCIDENT;

/** Drops each point that meets the one before it; for a closed outline, the last that meets the first too. */
function distinct<T extends BoundaryPoint>(list: readonly T[] | undefined, closed: boolean): T[] | undefined {
  if (!list) return undefined;
  const out: T[] = [];
  for (const p of list) if (!out.length || !near(out.at(-1)!, p)) out.push(p);
  if (closed && out.length > 1 && near(out[0]!, out.at(-1)!)) out.pop();
  return out;
}

/** The same outline (or section) with its coincident points removed; null when it has too few corners left. */
function tidyOutline<T extends BoundaryPoint>(list: readonly T[] | undefined): T[] | null | undefined {
  if (!list) return undefined;
  const out = distinct(list, true)!;
  return out.length >= 3 ? (out.length === list.length ? undefined : out) : null;
}

/** A part's outline and section after tidying: each kept as it was, tidied, or dropped (null: too few corners). */
function tidyParts<T extends { readonly outline?: readonly BoundaryPoint[] | undefined; readonly section?: readonly BoundaryPoint[] | undefined }>(part: T) {
  const outline = tidyOutline(part.outline), section = tidyOutline(part.section);
  const { outline: _o, section: _s, ...rest } = part;
  const kept = (was: readonly BoundaryPoint[] | undefined, now: BoundaryPoint[] | null | undefined) => now === undefined ? was : now ?? undefined;
  const o = kept(part.outline, outline), x = kept(part.section, section);
  return { rest, outline: o, section: x, changed: outline !== undefined || section !== undefined };
}

function cleanWall(w: StudioWall): StudioWall {
  const t = tidyParts(w);
  if (!t.changed) return w;
  return { ...t.rest, ...(t.outline ? { outline: t.outline } : {}), ...(t.section ? { section: t.section } : {}) } as StudioWall;
}

function cleanCeiling(c: StudioCeiling): StudioCeiling | null {
  const profile = distinct(c.profile, false) ?? [];
  if (profile.length < 2) return null;
  const t = tidyParts(c);
  if (!t.changed && profile.length === c.profile.length) return c;
  return { ...t.rest, profile, ...(t.outline ? { outline: t.outline } : {}), ...(t.section ? { section: t.section } : {}) } as StudioCeiling;
}

/** The room with its stored shapes made buildable (see the note above). Returns the same object when nothing changes. */
export function cleanStudio(studio: Studio): Studio {
  const walls = studio.walls.map(cleanWall);
  const ceilings = studio.ceilings?.flatMap(c => { const k = cleanCeiling(c); return k ? [k] : []; });
  const changed = walls.some((w, i) => w !== studio.walls[i]) || (ceilings !== undefined && (ceilings.length !== studio.ceilings!.length
    || ceilings.some((c, i) => c !== studio.ceilings![i])));
  return changed ? { ...studio, walls, ...(ceilings ? { ceilings } : {}) } : studio;
}
