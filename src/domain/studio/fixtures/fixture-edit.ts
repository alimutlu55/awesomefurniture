import { nextId, roomHeight } from '../studio';
import type { Studio } from '../studio';
import { fixtureDefinition, fixtureVariant, fixtureServices } from './fixture-catalog';
import type { FixtureAnchor, FixtureEnclosure, StudioFixture } from './fixture';
import { anchorPose, fixturePose, fixtureWall } from './fixture-geometry';

export function newFixture(s: Studio, kind: string, variantKey: string | undefined, anchor: FixtureAnchor): StudioFixture | null {
  const def = fixtureDefinition(kind), variant = variantKey === undefined ? def?.variants[0] : def?.variants.find(v => v.key === variantKey);
  if (!def || !variant) return null;
  return { id: nextId('fx', s.fixtures ?? []), kind: def.key as StudioFixture['kind'], variant: variant.key,
    w: variant.w, h: variant.h, d: variant.d, anchor, color: def.color, status: 'new',
    ...(variant.concealed ? { installation: { w: 50, h: 112, d: 18, access: 'front' } as const } : {}) };
}
export function updateFixture(s: Studio, id: string, patch: Partial<StudioFixture>): Studio | null {
  return s.fixtures?.some(f => f.id === id) ? { ...s, fixtures: s.fixtures.map(f => f.id === id ? { ...f, ...patch, id: f.id, kind: f.kind } : f) } : null;
}
export function changeFixtureVariant(s: Studio, id: string, key: string): Studio | null {
  const f = s.fixtures?.find(f => f.id === id), v = f && fixtureVariant(f.kind, key);
  if (!f || !v) return null;
  const { installation: _old, ...base } = f;
  let anchor = f.anchor;
  let baseStudio = s;
  if (!v.concealed && f.installation && anchor.kind === 'enclosure') {
    const own = anchor, e = s.enclosures?.find(e => e.id === own.enclosure);
    if (e?.generatedFor === id && !s.fixtures?.some(x => x.id !== id && x.anchor.kind === 'enclosure' && x.anchor.enclosure === e.id) && e.anchor.kind === 'wall') {
      anchor = { ...e.anchor, offset: e.anchor.offset + own.offset, y: v.elevation };
      baseStudio = { ...s, enclosures: s.enclosures!.filter(x => x.id !== e.id) };
    }
  }
  if (v.mounting === 'wall' && anchor.kind === 'fixture') {
    const pose = fixturePose(s, f), visited = new Set<string>();
    while (anchor.kind === 'fixture' && !visited.has(anchor.fixture)) {
      visited.add(anchor.fixture); const parent = s.fixtures?.find(x => x.id === (anchor as Extract<FixtureAnchor, { kind: 'fixture' }>).fixture);
      if (!parent) break;
      anchor = parent.anchor;
    }
    if (pose && anchor.kind === 'wall') anchor = { ...anchor, y: v.elevation };
  }
  if (v.mounting === 'surface' && anchor.kind !== 'fixture') {
    const support = [...s.fixtures ?? []].reverse().find(x => f.kind === 'basin' ? x.kind === 'vanity' : x.kind === 'basin' || x.kind === 'vanity');
    if (support) anchor = { kind: 'fixture', fixture: support.id, x: 0, z: f.kind === 'faucet' ? -support.d / 2 + v.d / 2 + 1 : 0, lift: 0 };
  }
  if (v.mounting === 'wall' && anchor.kind === 'floor') {
    const backing = fixtureWall(baseStudio, { ...f, anchor });
    if (backing) anchor = { kind: 'wall', ...backing, y: v.elevation, gap: 0 };
  }
  if (v.mounting === 'surface' && anchor.kind !== 'fixture') return null;
  if (v.mounting === 'wall' && anchor.kind !== 'wall' && anchor.kind !== 'enclosure') return null;
  if ('y' in anchor) anchor = { ...anchor, y: v.elevation };
  if (v.mounting === 'floor' && anchor.kind === 'wall') anchor = { kind: 'floor', ...anchorPose(baseStudio, anchor, v.d)! };
  // A concealed installation's enclosure remains separate when its bowl changes.
  const next: StudioFixture = { ...base, variant: key, w: v.w, h: v.h, d: v.d, anchor,
    ...(f.connections ? { connections: f.connections.filter(c => fixtureServices(f.kind, key).includes(c.role)) } : {}),
    installation: v.concealed ? { w: 50, h: 112, d: 18, access: 'front' } : undefined };
  return updateFixture(baseStudio, id, next);
}

export type InstallationMode = 'existing' | 'local' | 'full' | 'module';
export function setToiletInstallation(s: Studio, id: string, mode: InstallationMode | string): Studio | null {
  const f = s.fixtures?.find(f => f.id === id);
  if (!f || f.kind !== 'toilet' || !fixtureVariant(f.kind, f.variant)?.concealed) return null;
  const own = f.anchor, current = own.kind === 'enclosure' ? s.enclosures?.find(e => e.id === own.enclosure) : undefined;
  const wallAnchor = f.anchor.kind === 'wall' ? f.anchor : current?.anchor.kind === 'wall'
    ? { ...current.anchor, offset: current.anchor.offset + (f.anchor.kind === 'enclosure' ? f.anchor.offset : 0), y: f.anchor.kind === 'enclosure' ? f.anchor.y : 0 } : null;
  if (!wallAnchor) return null;
  let enclosures = [...s.enclosures ?? []], anchor: FixtureAnchor;
  if (mode === 'existing') anchor = { ...wallAnchor, gap: 0 };
  else {
    const shared = enclosures.find(e => e.id === mode);
    if (shared) anchor = { kind: 'enclosure', enclosure: shared.id, offset: 0, y: 'y' in f.anchor ? f.anchor.y : 0 };
    else {
      if (mode !== 'local' && mode !== 'full' && mode !== 'module') return null;
      const e: FixtureEnclosure = { id: nextId('fe', enclosures), name: mode === 'module' ? 'Finished cistern module' : 'Installation enclosure',
        anchor: { ...wallAnchor, y: 0 }, w: mode === 'module' ? 56 : 70, h: mode === 'full' ? roomHeight(s) : 120,
        d: 22, lining: 2, color: mode === 'module' ? '#3d4142' : '#e2d9cc', sideColor: '#e2d9cc', topColor: '#e9e8e2',
        finish: mode === 'module' ? 'panel' : 'paint', form: mode === 'module' ? 'module' : 'boxing', status: 'new', generatedFor: id };
      enclosures.push(e);
      anchor = { kind: 'enclosure', enclosure: e.id, offset: 0, y: 'y' in f.anchor ? f.anchor.y : 0 };
    }
  }
  const next = updateFixture({ ...s, enclosures }, id, { anchor });
  if (!next) return null;
  if (current?.generatedFor === id && !next.fixtures?.some(x => x.anchor.kind === 'enclosure' && x.anchor.enclosure === current.id)) {
    enclosures = enclosures.filter(e => e.id !== current.id);
  }
  return { ...next, enclosures };
}

/** Children share removal only through an explicit assembly action, never an implicit host deletion. */
export function removeFixture(s: Studio, id: string, assembly = false): Studio | null {
  const target = s.fixtures?.find(f => f.id === id);
  if (!target) return null;
  const removed = new Set(s.fixtures!.filter(f => f.id === id || (assembly && target.assembly && f.assembly === target.assembly)).map(f => f.id));
  if (s.fixtures!.some(f => !removed.has(f.id) && f.anchor.kind === 'fixture' && removed.has(f.anchor.fixture))) return null;
  const fixtures = s.fixtures!.filter(f => !removed.has(f.id));
  const enclosures = s.enclosures?.flatMap(e => {
    if (!e.generatedFor || !removed.has(e.generatedFor)) return [e];
    if (!fixtures.some(f => f.anchor.kind === 'enclosure' && f.anchor.enclosure === e.id)) return [];
    const { generatedFor: _owner, ...shared } = e; return [shared];
  });
  return { ...s, fixtures, ...(enclosures ? { enclosures } : {}) };
}

export function duplicateFixtures(s: Studio, id: string, assembly: boolean, distance: number): { studio: Studio; id: string } | null {
  const target = s.fixtures?.find(f => f.id === id);
  if (!target) return null;
  const members = s.fixtures!.filter(f => f.id === id || (assembly && target.assembly && f.assembly === target.assembly));
  if (!assembly && members.some(f => f.anchor.kind === 'fixture')) return null;
  let fixtures = [...s.fixtures!], enclosures = [...s.enclosures ?? []];
  const ids = new Map<string, string>(), group = nextId('fa', s.fixtures!.flatMap(f => f.assembly ? [{ id: f.assembly }] : []));
  for (const f of members) { const fid = nextId('fx', fixtures); ids.set(f.id, fid); fixtures.push({ ...f, id: fid }); }
  for (const f of members) {
    if (f.anchor.kind !== 'enclosure' || ids.has(f.anchor.enclosure)) continue;
    const eid = f.anchor.enclosure, e = enclosures.find(e => e.id === eid);
    if (!e || e.generatedFor !== f.id) continue;
    const nid = nextId('fe', enclosures); ids.set(eid, nid);
    const anchor = e.anchor.kind === 'wall' ? { ...e.anchor, offset: e.anchor.offset + distance } : { ...e.anchor, x: e.anchor.x + distance };
    enclosures.push({ ...e, id: nid, anchor, generatedFor: ids.get(f.id)! });
  }
  for (const original of members) {
    let anchor = original.anchor;
    if (anchor.kind === 'floor') anchor = { ...anchor, x: anchor.x + distance };
    else if (anchor.kind === 'wall') anchor = { ...anchor, offset: anchor.offset + distance };
    else if (anchor.kind === 'fixture') anchor = { ...anchor, fixture: ids.get(anchor.fixture) ?? anchor.fixture };
    else anchor = { ...anchor, enclosure: ids.get(anchor.enclosure) ?? anchor.enclosure,
      offset: ids.has(anchor.enclosure) ? anchor.offset : anchor.offset + distance };
    const { connections: _links, assembly: _oldGroup, ...copy } = original;
    fixtures = fixtures.map(f => f.id === ids.get(original.id) ? { ...copy, id: f.id, anchor, ...(assembly ? { assembly: group } : {}) } : f);
  }
  return { studio: { ...s, fixtures, enclosures }, id: ids.get(id)! };
}
