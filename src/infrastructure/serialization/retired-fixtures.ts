/**
 * Reads designs saved by the reverted fixtures build (schema version 3, October 2026): its `studio.fixtures` had
 * `variant`, `w`/`h`/`d`, an `anchor` (a wall, a boxing it called an enclosure, another fixture or the floor) and
 * more, beside a `studio.enclosures` list. Such a design opens as a version 1 design with what this editor can
 * build from it: toilets and basins become fixtures of their nearest type, enclosures on a wall become boxings,
 * and a bowl standing on a vanity becomes a countertop basin as wide as the vanity. Kinds this editor has no
 * fixture for (taps, mirrors, showers, baths) are left out; a basin's tap is part of the basin now. Each part is
 * kept only if the room stays buildable with it, so the design always opens.
 */
import type { Studio, StudioCeiling, StudioFixture } from '../../domain/studio/studio';
import { nextId, wall, wallLine } from '../../domain/studio/studio';
import { fixtureType } from '../../domain/studio/fixtures/fixture-kinds';
import { studioProblems } from '../../domain/studio/studio-validation';

type Raw = Record<string, unknown>;
const object = (v: unknown): v is Raw => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown) => typeof v === 'string' && v.trim() ? v : undefined;
const round = (n: number) => Math.round(n * 10) / 10;

/** Whether a document is in the retired fixtures format. */
export function isRetiredFixtureDocument(document: unknown): boolean {
  if (!object(document) || !object(document.studio)) return false;
  const fixtures = document.studio.fixtures, retired = Array.isArray(fixtures) && fixtures.some(f => object(f) && ('anchor' in f || 'variant' in f));
  return document.schemaVersion === 3 || 'enclosures' in document.studio || retired;
}

/** This editor's type for a retired kind and variant; null for kinds it has no fixture for. */
function typeFor(kind: string, variant: string): { kind: 'toilet' | 'basin'; type: string } | null {
  if (kind === 'toilet') return { kind, type: ['wall-hung', 'close-coupled', 'back-to-wall'].includes(variant) ? variant : 'wall-hung' };
  if (kind === 'basin') return { kind, type: variant === 'pedestal' ? 'pedestal' : variant === 'vessel' ? 'countertop' : 'wall-hung' };
  return null;
}

/** Where along a wall a retired anchor puts the middle of something, and how high its base is: on the wall itself,
 * on an enclosure (along it from the enclosure's middle), or on another fixture (along it from that one's middle). */
function place(anchor: unknown, enclosures: Raw[], fixtures: Raw[], seen = new Set<unknown>()): { wall: string; offset: number; y: number } | null {
  if (!object(anchor) || seen.has(anchor)) return null;
  seen.add(anchor);
  if (anchor.kind === 'wall' && str(anchor.wall)) return { wall: anchor.wall as string, offset: num(anchor.offset), y: num(anchor.y) };
  const host = anchor.kind === 'enclosure' ? enclosures.find(e => e.id === anchor.enclosure) : anchor.kind === 'fixture' ? fixtures.find(f => f.id === anchor.fixture) : undefined;
  const base = host && place(host.anchor, enclosures, fixtures, seen);
  if (!host || !base) return null;
  const along = anchor.kind === 'enclosure' ? num(anchor.offset) : num(anchor.x);
  const up = anchor.kind === 'enclosure' ? num(anchor.y) : num(host.h) + num(anchor.lift);
  return { wall: base.wall, offset: base.offset + along, y: base.y + up };
}

const within = (v: number, [min, max]: readonly [number, number]) => round(Math.min(max, Math.max(min, v)));

/** The document as version 1, with what this editor can build of its retired fixtures (see above). */
export function withoutRetiredFixtures(document: unknown): unknown {
  if (!isRetiredFixtureDocument(document)) return document;
  const doc = document as Raw, raw = doc.studio as Raw;
  const enclosures = (Array.isArray(raw.enclosures) ? raw.enclosures : []).filter(object), fixtures = (Array.isArray(raw.fixtures) ? raw.fixtures : []).filter(object);
  const { enclosures: _e, fixtures: _f, ...rest } = raw;
  let studio = rest as unknown as Studio;
  const keep = (next: Studio) => { if (studioProblems(next).length <= studioProblems(studio).length) studio = next; };
  // Enclosures on a wall become boxings: the same span along it, height and depth out from its face.
  for (const e of enclosures) {
    const at = place(e.anchor, [], []), w = at && wall(studio, at.wall);
    if (!at || !w || !wallLine(studio, w)) continue;
    const half = num(e.w) / 2, depth = Math.max(20, round(num(e.d) + num((e.anchor as Raw).gap))), height = round(num(e.h, 120));
    const from = round(at.offset - half), to = round(at.offset + half);
    const boxing: StudioCeiling = { id: nextId('k', studio.ceilings ?? []), wall: at.wall, run: 'along', depth,
      outline: [{ t: from, y: 0 }, { t: to, y: 0 }, { t: to, y: height }, { t: from, y: height }], profile: [{ t: from, y: 0 }, { t: to, y: 0 }] };
    keep({ ...studio, ceilings: [...studio.ceilings ?? [], boxing] });
  }
  for (const f of fixtures) {
    const mapped = typeFor(String(f.kind), String(f.variant ?? '')), at = mapped && place(f.anchor, enclosures, fixtures);
    if (!mapped || !at) continue;
    // A bowl on a vanity: the vanity gives the countertop's width and depth.
    const host = object(f.anchor) && f.anchor.kind === 'fixture' ? fixtures.find(x => x.id === (f.anchor as Raw).fixture) : undefined;
    const t = fixtureType(mapped.kind, mapped.type)!, width = num(host?.w, num(f.w)), depth = num(host?.d, num(f.d));
    const height = mapped.kind === 'basin' ? at.y + num(f.h) : t.size.height;
    const fixture: StudioFixture = { id: nextId('f', studio.fixtures ?? []), wall: at.wall, kind: mapped.kind, type: t.id, offset: round(at.offset),
      width: within(width, t.limits.width), depth: within(depth, t.limits.depth), height: within(height, t.limits.height) };
    keep({ ...studio, fixtures: [...studio.fixtures ?? [], fixture] });
  }
  return { ...doc, schemaVersion: 1, studio };
}
