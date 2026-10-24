import type { Studio } from '../studio';
import { wallBox, wallFace, wallLine } from '../studio';
import { fixtureDefinition, fixtureVariant, fixtureServices } from './fixture-catalog';
import type { FixtureAnchor } from './fixture';
import { fixturePose, enclosurePose, fixtureSolids, localPose } from './fixture-geometry';
import { createCabinetGeometry } from '../../geometry/cabinet-geometry.js';
import type { Obstacle } from '../studio-obstacles';
import { ceilingAt } from '../studio-ceiling';
import { isWallUtility } from '../wall-utilities';

const color = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const size = (n: number) => Number.isFinite(n) && n >= .5 && n <= 500;
export function fixtureDataProblems(s: Studio): string[] {
  const out: string[] = [], ids = new Set([...s.corners, ...s.walls, ...s.openings, ...s.ceilings ?? []].map(x => x.id));
  const checkAnchor = (a: FixtureAnchor, w: number, h: number, name: string) => {
    if (a.kind === 'wall') {
      const wall = s.walls.find(w => w.id === a.wall), face = wall && wallFace(s, wall);
      if (!face) out.push(name + ': choose an existing wall.');
      else if (a.offset - w / 2 < face.start - .01 || a.offset + w / 2 > face.end + .01) out.push(name + ': keep the full width on its wall.');
      if (!Number.isFinite(a.gap) || a.gap < 0) out.push(name + ': wall gap must be zero or greater.');
      for (const opening of s.openings.filter(o => o.wall === a.wall && !isWallUtility(o.kind))) {
        if (Math.abs(a.offset - opening.offset) < (w + opening.width) / 2 - .01
          && a.y < opening.sill + opening.height - .01 && a.y + h > opening.sill + .01) {
          out.push(name + ': choose solid wall outside the ' + opening.kind + ' opening.');
        }
      }
    } else if (a.kind === 'enclosure') {
      const e = s.enclosures?.find(e => e.id === a.enclosure);
      if (!e) out.push(name + ': choose an existing enclosure.');
      else if (Math.abs(a.offset) + w / 2 > e.w / 2 + .01) out.push(name + ': keep the full width on its enclosure.');
    } else if (a.kind === 'fixture') {
      if (!s.fixtures?.some(f => f.id === a.fixture)) out.push(name + ': choose an existing support.');
    }
    for (const n of Object.values(a)) if (typeof n === 'number' && !Number.isFinite(n)) out.push(name + ': enter a finite position.');
    if ('y' in a && a.y < 0) out.push(name + ': keep it above the finished floor.');
  };
  for (const item of [...s.enclosures ?? [], ...s.fixtures ?? []]) {
    if (!item.id || ids.has(item.id)) out.push('Every fixture and enclosure needs a unique ID.');
    ids.add(item.id);
    const validWidth = size(item.w) || (!('kind' in item) && Number.isFinite(item.w) && item.w >= .5 && item.w <= 2000);
    if (!validWidth || ![item.h, item.d].every(size)) out.push('Enter a valid fixture size; enclosures can span up to 2000 cm, other dimensions up to 500 cm.');
    if (!color(item.color)) out.push('Choose a valid fixture finish color.');
  }
  for (const e of s.enclosures ?? []) {
    checkAnchor(e.anchor, e.w, e.h, e.name);
    if (!enclosurePose(s, e)) out.push(e.name + ': its mounting surface is missing.');
    if (!Number.isFinite(e.lining) || e.lining < 0 || e.lining * 2 >= Math.min(e.w, e.d)) out.push(e.name + ': lining must fit inside the enclosure.');
    if (!color(e.topColor) || !color(e.sideColor)) out.push(e.name + ': choose valid side and top finishes.');
  }
  for (const f of s.fixtures ?? []) {
    const def = fixtureDefinition(f.kind), variant = fixtureVariant(f.kind, f.variant), p = fixturePose(s, f);
    const name = def?.name ?? 'Fixture';
    if (!def || !variant) out.push('Choose a supported fixture and variant.');
    if (def && (f.w < def.minimum.w || f.h < def.minimum.h || f.d < def.minimum.d)) {
      out.push(name + ': minimum editable size is ' + [def.minimum.w, def.minimum.h, def.minimum.d].join(' × ') + ' cm (width × height × depth).');
    }
    checkAnchor(f.anchor, f.w, f.h, name);
    if (!p) out.push(name + ': its attachment is missing or circular.');
    if (variant?.mounting === 'wall' && f.anchor.kind !== 'wall' && f.anchor.kind !== 'enclosure') out.push(name + ': choose a wall or enclosure.');
    if (variant?.mounting === 'surface' && f.anchor.kind !== 'fixture') out.push(name + ': choose a supporting basin or vanity.');
    if (f.anchor.kind === 'fixture') {
      const a = f.anchor, host = s.fixtures?.find(x => x.id === a.fixture);
      const allowed = host && (f.kind === 'basin' ? host.kind === 'vanity' : f.kind === 'faucet' && (host.kind === 'basin' || host.kind === 'vanity'));
      if (!allowed) out.push(name + ': this item cannot be mounted on that support.');
      if (host && (Math.abs(a.x) + f.w / 2 > host.w / 2 + .01 || Math.abs(a.z) + f.d / 2 > host.d / 2 + .01)) out.push(name + ': keep its footprint on its support.');
      if (a.lift < 0) out.push(name + ': keep it above its support.');
    }
    if (f.anchor.kind === 'enclosure') {
      const a = f.anchor, e = s.enclosures?.find(e => e.id === a.enclosure);
      if (e && a.y + f.h > e.h + .01) out.push(name + ': the mounting surface is not tall enough.');
    }
    if (variant?.concealed && !f.installation) out.push(name + ': reserve its concealed cistern and carrier volume.');
    if (f.installation) {
      if (![f.installation.w, f.installation.h, f.installation.d].every(size)) out.push(name + ': enter a valid installation volume.');
      if (f.anchor.kind === 'enclosure') {
        const a = f.anchor, e = s.enclosures?.find(x => x.id === a.enclosure), i = f.installation;
        if (e && (Math.abs(a.offset) + i.w / 2 > e.w / 2 - e.lining + .01 || i.h > e.h - e.lining + .01 || i.d > e.d - e.lining + .01)) {
          out.push(name + ': the enclosure is too small for its reserved cistern and support.');
        }
      }
    }
    for (const c of f.connections ?? []) {
      const utility = s.openings.find(o => o.id === c.utility);
      const required = c.role === 'power' ? 'socket' : c.role === 'vent' ? 'duct' : c.role === 'heating' ? 'water' : 'water';
      if (!utility || utility.kind !== required) out.push(name + ': choose a compatible service point.');
      if (!fixtureServices(f.kind, f.variant).includes(c.role)) out.push(name + ': this service is not required.');
    }
    if (new Set(f.connections?.map(c => c.role)).size !== (f.connections?.length ?? 0)) out.push(name + ': assign each service only once.');
  }
  return [...new Set(out)];
}

/** Bidirectional physical collision check against the rest of the scene. Access areas remain advisory. */
export function fixturePhysicalProblem(s: Studio, obstacles: readonly Obstacle[]): string | null {
  const solids = fixtureSolids(s), geometry = createCabinetGeometry(() => []);
  for (let i = 0; i < solids.length; i++) {
    const a = solids[i]!;
    for (const b of [...solids.slice(i + 1), ...obstacles]) {
      if (a.id === b.id || !geometry.cabinetOverlaps(a, b)) continue;
      const name = (id: string) => id.startsWith('enclosure:') ? 'Installation enclosure'
        : fixtureDefinition(s.fixtures?.find(f => 'fixture:' + f.id === id)?.kind ?? '')?.name ?? (id.startsWith('wall:') ? 'Wall' : 'Furniture or room shape');
      return name(a.id) + ' overlaps ' + name(String(b.id)).toLowerCase() + '. Move or resize one of them.';
    }
    if (s.walls.length) {
      const p = { ...a, angle: a.angle }, top = a.y + a.state.h;
      for (const [x, z] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const q = localPose(p, x! * a.state.w / 2, 0, z! * a.state.d / 2);
        if (top > ceilingAt(s, q) + .5) return 'The fixture or enclosure must fit below the ceiling.';
      }
    }
  }
  return null;
}

export interface FixtureFinding { readonly id: string; readonly message: string }
export function fixtureFindings(s: Studio, id: string, others: readonly Obstacle[] = []): FixtureFinding[] {
  const f = s.fixtures?.find(f => f.id === id), def = f && fixtureDefinition(f.kind), p = f && fixturePose(s, f);
  if (!f || !def || !p) return [];
  const out: FixtureFinding[] = [];
  const services = fixtureServices(f.kind, f.variant);
  if (services.some(role => !(f.connections ?? []).some(c => c.role === role))) out.push({ id: 'services', message: 'Confirm ' + services.join(', ') + ' connections.' });
  if (f.installation && f.anchor.kind !== 'enclosure') out.push({ id: 'support', message: 'Existing concealed cistern, cavity and support are unconfirmed.' });
  const clearance = def.clearance;
  if (clearance) {
    const area: Obstacle = { id: 'clearance', ...localPose(p, 0, 0, (f.d + clearance) / 2), state: { w: f.w, h: Math.max(80, f.h), d: clearance } };
    const geom = createCabinetGeometry(() => []);
    const walls = s.walls.flatMap(w => { const b = wallBox(s, w); return b ? [{ ...b, state: { w: b.length, h: b.height, d: b.thickness } }] : []; });
    if ([...fixtureSolids(s), ...walls, ...others].some(b => b.id !== 'fixture:' + id && geom.cabinetOverlaps(area, b))) {
      out.push({ id: 'access', message: 'The suggested ' + clearance + ' cm front access area is obstructed.' });
    }
  }
  if (f.kind === 'shower-screen' && f.variant !== 'fixed') out.push({ id: 'swing', message: 'Check the hinged door opening area before installation.' });
  const geometry = createCabinetGeometry(() => []), physical = fixtureSolids(s).filter(b => b.id === 'fixture:' + id);
  for (const o of s.openings.filter(o => !isWallUtility(o.kind) && o.sill < 1)) {
    const wall = s.walls.find(w => w.id === o.wall), line = wall && wallLine(s, wall);
    if (!wall || !line) continue;
    const distance = wall.thickness / 2 + 35, access: Obstacle = { id: 'door-access:' + o.id,
      x: line.a.x + line.ux * o.offset + line.nx * distance, z: line.a.z + line.uz * o.offset + line.nz * distance,
      y: 0, angle: line.angle, state: { w: o.width, h: o.height, d: 70 } };
    if (physical.some(b => geometry.cabinetOverlaps(b, access))) { out.push({ id: 'door-access', message: 'Check the obstructed doorway approach and door swing.' }); break; }
  }
  out.push({ id: 'generic', message: 'Generic planning dimensions; confirm product installation data.' });
  return out;
}

/** Rebind attachments after a split; preserve their original world datum on the replacement segment. */
export function reconcileFixtureHosts(before: Studio, next: Studio): Studio {
  if (before.walls.length === next.walls.length) return next;
  const remap = (a: FixtureAnchor, width: number): FixtureAnchor => {
    if (a.kind !== 'wall') return a;
    const old = before.walls.find(w => w.id === a.wall), was = old && wallLine(before, old);
    const current = next.walls.find(w => w.id === a.wall), now = current && wallLine(next, current);
    if (!was || (now && a.offset + width / 2 <= now.length + .01)) return a;
    const x = was.a.x + was.ux * a.offset, z = was.a.z + was.uz * a.offset;
    for (const w of next.walls) {
      const line = wallLine(next, w);
      if (!line || Math.abs(line.ux * was.ux + line.uz * was.uz - 1) > .001) continue;
      const along = (x - line.a.x) * line.ux + (z - line.a.z) * line.uz, across = (x - line.a.x) * line.nx + (z - line.a.z) * line.nz;
      if (Math.abs(across) < .01 && along >= width / 2 && along <= line.length - width / 2) return { ...a, wall: w.id, offset: along };
    }
    return a;
  };
  return { ...next, ...(next.fixtures ? { fixtures: next.fixtures.map(f => ({ ...f, anchor: remap(f.anchor, f.w) })) } : {}),
    ...(next.enclosures ? { enclosures: next.enclosures.map(e => ({ ...e, anchor: remap(e.anchor, e.w) as typeof e.anchor })) } : {}) };
}
