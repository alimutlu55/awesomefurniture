import type { EditorScene } from '../projects/editor-scene';
import type { Studio } from '../../domain/studio/studio';
import { wallFace, wallLine } from '../../domain/studio/studio';
import type { FixtureAnchor, StudioFixture } from '../../domain/studio/fixtures/fixture';
import { fixtureDefinition } from '../../domain/studio/fixtures/fixture-catalog';
import { newFixture, updateFixture, removeFixture, changeFixtureVariant, setToiletInstallation, duplicateFixtures } from '../../domain/studio/fixtures/fixture-edit';
import { fixturePhysicalProblem } from '../../domain/studio/fixtures/fixture-validation';
import { studioProblems } from '../../domain/studio/studio-validation';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { anchorPose, fixturePose, fixtureWall, localPose } from '../../domain/studio/fixtures/fixture-geometry';
import { nextId } from '../../domain/studio/studio';

interface Ports {
  getScene(): EditorScene;
  checkpoint(): void;
  report(message: string): void;
}
export interface FixturePlacement {
  readonly wall?: string | undefined; readonly support?: string | undefined; readonly along?: number | undefined; readonly enclosure?: string | undefined;
  readonly exact?: boolean;
}

/** Complete fixture changes validate before one history checkpoint. Preview calls never write history. */
export function createFixtureCommands({ getScene, checkpoint, report }: Ports) {
  const empty = (): Studio => ({ template: 'custom', corners: [], walls: [], openings: [] });
  function problem(s: Studio): string | null {
    const scene = getScene(), solids = studioObstacles({ ...s, fixtures: [], enclosures: [] });
    return studioProblems(s)[0] ?? fixturePhysicalProblem(s, [...solids, ...scene.wardrobes.map(c => ({
      id: 'cabinet:' + c.id, x: c.x, y: c.y, z: c.z, angle: c.angle, state: c.state,
    }))]);
  }
  function commit(next: Studio | null, history = true, quiet = false): boolean {
    if (!next) { if (!quiet) report('Reattach dependent fixtures first, or choose Remove assembly.'); return false; }
    const issue = problem(next);
    if (issue) { if (!quiet) report(issue); return false; }
    if (JSON.stringify(next) === JSON.stringify(getScene().studio)) return false;
    if (history) checkpoint();
    getScene().studio = next;
    return true;
  }
  function add(kind: string, placement: FixturePlacement = {}, variant?: string, boxed = false): string | null {
    const s = getScene().studio ?? empty(), def = fixtureDefinition(kind), v = variant === undefined ? def?.variants[0] : def?.variants.find(v => v.key === variant);
    if (!def || !v) return null;
    const host = s.fixtures?.find(f => f.id === placement.support);
    const support = host ?? [...s.fixtures ?? []].reverse().find(f => kind === 'basin' ? f.kind === 'vanity' : f.kind === 'basin' || f.kind === 'vanity');
    if (v.mounting === 'surface') {
      if (!support) {
        const wallVariant = !variant && def.variants.find(v => v.mounting === 'wall');
        if (wallVariant) return add(kind, placement, wallVariant.key);
        report('Add a compatible basin or vanity first, then choose it as the support.'); return null;
      }
      const f = newFixture(s, kind, v.key, { kind: 'fixture', fixture: support.id, x: 0,
        z: kind === 'faucet' ? -support.d / 2 + v.d / 2 + 1 : 0, lift: 0 })!;
      return commit({ ...s, fixtures: [...s.fixtures ?? [], f] }) ? f.id : null;
    }
    const enclosure = s.enclosures?.find(e => e.id === placement.enclosure);
    if (enclosure) {
      for (let n = 0; n <= enclosure.w; n += 5) for (const sign of n === 0 ? [1] : [1, -1]) {
        const f = newFixture(s, kind, v.key, { kind: 'enclosure', enclosure: enclosure.id, offset: n * sign, y: v.elevation })!;
        const next = { ...s, fixtures: [...s.fixtures ?? [], f] };
        if (!problem(next) && commit(next)) return f.id;
      }
      report('This enclosure has no free space for that fixture. Widen it or choose another host.'); return null;
    }
    const walls = placement.wall ? s.walls.filter(w => w.id === placement.wall) : [...s.walls].sort((a, b) => (wallLine(s, b)?.length ?? 0) - (wallLine(s, a)?.length ?? 0));
    let last = 'There is no free space for that fixture. Move an item or choose another wall.';
    for (const w of walls) {
      const face = wallFace(s, w);
      if (!face) continue;
      const start = placement.along ?? (face.start + face.end) / 2, offsets = [start];
      if (!placement.exact) for (let n = 10; n <= face.length; n += 10) offsets.push(start + n, start - n);
      for (const offset of offsets) {
        const onWall: FixtureAnchor = { kind: 'wall', wall: w.id, offset, y: v.elevation, gap: 0 };
        const anchor: FixtureAnchor = v.mounting === 'floor' ? { kind: 'floor', ...anchorPose(s, onWall, v.d)! } : onWall;
        const f = newFixture(s, kind, v.key, anchor)!;
        let next: Studio = { ...s, fixtures: [...s.fixtures ?? [], f] };
        if (boxed) next = setToiletInstallation(next, f.id, 'local') ?? next;
        const issue = problem(next);
        if (issue) { last = issue; continue; }
        if (commit(next)) return f.id;
      }
    }
    if (v.mounting === 'floor' && !placement.wall) {
      for (let x = 0; x < 1200; x += 20) {
        const f = newFixture(s, kind, v.key, { kind: 'floor', x, z: 100, y: v.elevation, angle: 0 })!;
        const next = { ...s, fixtures: [...s.fixtures ?? [], f] };
        if (!problem(next) && commit(next)) return f.id;
      }
    }
    report(!walls.length && v.mounting === 'wall' ? 'Add a wall first, then place this fixture on it.' : last);
    return null;
  }
  const current = () => getScene().studio;
  function addEnclosure(placement: FixturePlacement = {}): string | null {
    const s = current();
    if (!s?.walls.length) { report('Add a wall first, then its installation enclosure.'); return null; }
    for (const w of placement.wall ? s.walls.filter(w => w.id === placement.wall) : s.walls) {
      const face = wallFace(s, w);
      if (!face) continue;
      const center = placement.along ?? (face.start + face.end) / 2;
      for (let n = 0; n < face.length; n += 10) for (const sign of n ? [1, -1] : [1]) {
        const id = nextId('fe', s.enclosures ?? []);
        const e = { id, name: 'Installation enclosure', w: 70, h: 120, d: 22, lining: 2, color: '#e2d9cc', sideColor: '#e2d9cc', topColor: '#e9e8e2',
          finish: 'paint' as const, form: 'boxing' as const, status: 'new' as const,
          anchor: { kind: 'wall' as const, wall: w.id, offset: center + n * sign, y: 0, gap: 0 } };
        const next = { ...s, enclosures: [...s.enclosures ?? [], e] };
        if (!problem(next) && commit(next)) return id;
      }
    }
    report('No free wall space for an installation enclosure.'); return null;
  }
  function preparePreset(key: string, placement: FixturePlacement): { studio: Studio; id: string } | string {
    const staged = structuredClone(getScene()), messages: string[] = [];
    const commands = createFixtureCommands({ getScene: () => staged, checkpoint() {}, report: m => messages.push(m) });
    const root = key === 'toilet-boxed' ? commands.add('toilet', placement, 'wall-hung', true)
      : key === 'vanity-set' ? commands.add('vanity', placement) : key === 'shower-set' ? commands.add('shower-tray', placement) : null;
    if (!root || !staged.studio) return messages.at(-1) ?? 'This assembly needs a compatible wall and free space.';
    const originalIds = new Set(getScene().studio?.fixtures?.map(f => f.id)), rootFixture = staged.studio.fixtures!.find(f => f.id === root)!;
    const backing = fixtureWall(staged.studio, rootFixture);
    const along = rootFixture.anchor.kind === 'wall' ? rootFixture.anchor.offset : backing?.offset;
    const wall = rootFixture.anchor.kind === 'wall' ? rootFixture.anchor.wall : placement.wall ?? backing?.wall;
    if (key === 'vanity-set') {
      const basin = commands.add('basin', { support: root }, 'vessel');
      if (!basin || !commands.add('faucet', { support: basin }) || !commands.add('mirror', { wall, along, exact: true })) {
        return messages.at(-1) ?? 'This vanity assembly does not fit.';
      }
    }
    if (key === 'shower-set') {
      const pose = fixturePose(staged.studio, rootFixture)!;
      const screen = newFixture(staged.studio, 'shower-screen', 'fixed', { kind: 'floor', ...localPose(pose, 0, rootFixture.h, rootFixture.d / 2) })!;
      staged.studio = { ...staged.studio, fixtures: [...staged.studio.fixtures!, screen] };
      if (!commands.add('shower-set', { wall, along, exact: true })) return messages.at(-1) ?? 'The shower fittings do not fit.';
    }
    const group = nextId('fa', staged.studio.fixtures!.flatMap(f => f.assembly ? [{ id: f.assembly }] : []));
    const next = { ...staged.studio, fixtures: staged.studio.fixtures!.map(f => originalIds.has(f.id) ? f : { ...f, assembly: group }) };
    return { studio: next, id: root };
  }
  function preset(key: string, placement: FixturePlacement = {}): string | null {
    const s = current(), candidates: FixturePlacement[] = [];
    if (s && !placement.enclosure) for (const wall of placement.wall ? s.walls.filter(w => w.id === placement.wall) : s.walls) {
      const face = wallFace(s, wall);
      if (!face) continue;
      const center = placement.along ?? (face.start + face.end) / 2;
      for (let n = 0; n <= face.length; n += 10) for (const sign of n ? [1, -1] : [1]) {
        const along = center + n * sign;
        if (along >= face.start && along <= face.end) candidates.push({ ...placement, wall: wall.id, along, exact: true });
      }
    }
    if (!candidates.length) candidates.push(placement);
    let reason = 'This complete assembly does not fit.';
    for (const p of candidates) {
      const result = preparePreset(key, p);
      if (typeof result === 'string') { reason = result; continue; }
      if (commit(result.studio)) return result.id;
    }
    report(reason); return null;
  }
  return {
    add, addEnclosure, preset, commit, problem,
    update(id: string, patch: Partial<StudioFixture>, history = true, quiet = false) {
      const s = current(); return !!s && commit(updateFixture(s, id, patch), history, quiet);
    },
    variant(id: string, key: string) { const s = current(); return !!s && commit(changeFixtureVariant(s, id, key)); },
    installation(id: string, mode: string) { const s = current(); return !!s && commit(setToiletInstallation(s, id, mode)); },
    remove(id: string, assembly = false) { const s = current(); return !!s && commit(removeFixture(s, id, assembly)); },
    duplicate(id: string, assembly = false): string | null {
      const s = current(), f = s?.fixtures?.find(f => f.id === id);
      if (!s || !f) return null;
      for (const sign of [1, -1]) for (let d = f.w + 10; d <= 1000; d += 10) {
        const next = duplicateFixtures(s, id, assembly, d * sign);
        if (next && !problem(next.studio) && commit(next.studio)) return next.id;
      }
      report('No room for a copy. A mounted accessory can be copied with its assembly.'); return null;
    },
    move(id: string, anchor: FixtureAnchor, history = true, quiet = false) {
      const s = current(); return !!s && commit(updateFixture(s, id, { anchor }), history, quiet);
    },
  };
}
