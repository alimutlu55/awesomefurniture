import type { Studio } from '../studio';
import { wallLine } from '../studio';
import type { FixtureAnchor } from './fixture';
import { fixturePose } from './fixture-geometry';
import { updateFixture } from './fixture-edit';

/** Move assembly roots once. Supported children follow their hosts; shared construction stays independent. */
export function moveFixtureAssembly(s: Studio, id: string, anchor: FixtureAnchor): Studio | null {
  const selected = s.fixtures?.find(f => f.id === id);
  if (!selected?.assembly) return updateFixture(s, id, { anchor });
  const trial = updateFixture(s, id, { anchor }), target = trial?.fixtures?.find(f => f.id === id);
  const before = fixturePose(s, selected), after = trial && target && fixturePose(trial, target);
  if (!before || !after) return null;
  const dx = after.x - before.x, dz = after.z - before.z, dy = after.y - before.y, angle = after.angle - before.angle;
  const turn = angle * Math.PI / 180, members = s.fixtures!.filter(f => f.assembly === selected.assembly), ids = new Set(members.map(f => f.id));
  const movedEnclosures = new Set<string>();
  let failed = false;
  const moveAnchor = (a: FixtureAnchor): FixtureAnchor => {
    if (a.kind === 'fixture') return a;
    if (a.kind === 'floor') {
      const x = a.x - before.x, z = a.z - before.z;
      return { ...a, x: after.x + x * Math.cos(turn) + z * Math.sin(turn), z: after.z - x * Math.sin(turn) + z * Math.cos(turn), y: a.y + dy, angle: a.angle + angle };
    }
    if (a.kind === 'wall') {
      const wall = s.walls.find(w => w.id === a.wall), line = wall && wallLine(s, wall);
      if (!line || Math.abs(angle) > .001 || Math.abs(dx * line.nx + dz * line.nz) > .01) { failed = true; return a; }
      return { ...a, offset: a.offset + dx * line.ux + dz * line.uz, y: a.y + dy };
    }
    const e = s.enclosures?.find(e => e.id === a.enclosure);
    const shared = s.fixtures!.some(f => !ids.has(f.id) && f.anchor.kind === 'enclosure' && f.anchor.enclosure === a.enclosure);
    if (e && !shared) { movedEnclosures.add(e.id); return a; }
    const wall = e?.anchor.kind === 'wall' ? s.walls.find(w => e.anchor.kind === 'wall' && w.id === e.anchor.wall) : undefined;
    const line = wall && wallLine(s, wall);
    if (!line || Math.abs(angle) > .001 || Math.abs(dx * line.nx + dz * line.nz) > .01) { failed = true; return a; }
    return { ...a, offset: a.offset + dx * line.ux + dz * line.uz, y: a.y + dy };
  };
  const fixtures = s.fixtures!.map(f => !ids.has(f.id) || (f.anchor.kind === 'fixture' && ids.has(f.anchor.fixture)) ? f : { ...f, anchor: moveAnchor(f.anchor) });
  const enclosures = s.enclosures?.map(e => movedEnclosures.has(e.id) ? { ...e, anchor: moveAnchor(e.anchor) as typeof e.anchor } : e);
  return failed ? null : { ...s, fixtures, ...(enclosures ? { enclosures } : {}) };
}
