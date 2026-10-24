import type { EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioFixture } from '../../domain/studio/studio';
import { studioProblems } from '../../domain/studio/studio-validation';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { fixtureKind } from '../../domain/studio/fixtures/fixture-kinds';
import { addFixture, duplicateFixture, removeFixture } from '../../domain/studio/fixtures/fixture-edit';
import { applySetup, standsOnFloor } from '../../domain/studio/fixtures/fixture-setup';
import { fixtureProblems } from '../../domain/studio/fixtures/fixture-validation';

interface FixtureCommandOptions {
  checkpoint: () => void;
  report: (message: string) => void;
}
type Result = { studio: Studio; note?: string | undefined };
const asResult = (out: Studio | Result | null): Result | null => !out ? null : 'corners' in out ? { studio: out } : out;

const name = (kind: string) => fixtureKind(kind)?.name.toLowerCase() ?? 'fixture';
/** Places to try along a wall, nearest `from` first, every 5 cm either way. */
/** Whether a fixture would stand half in front of a boxing and half against the bare wall: buildable, but nobody plans
 * a basin that way, so a new one goes there only when nowhere else fits. */
function straddles(room: Studio, f: StudioFixture) {
  const l = f.offset - f.width / 2, r = f.offset + f.width / 2;
  return (room.ceilings ?? []).some(c => {
    if (c.wall !== f.wall || !standsOnFloor(c)) return false;
    const ts = c.outline!.map(p => p.t), from = Math.min(...ts), to = Math.max(...ts);
    return (from > l + .5 && from < r - .5) || (to > l + .5 && to < r - .5);
  });
}
function spots(from: number, start: number, end: number) {
  const out: number[] = [];
  for (let d = 0; d <= end - start; d += 5) for (const s of d ? [from - d, from + d] : [from]) if (s >= start && s <= end) out.push(s);
  return out;
}

/** Toilets, basins and the other fixtures: added where there is room for them (and their boxing), changed, copied and
 * removed. Every change is checked by the room's rules and against the furniture, and refused with the reason. */
export function createFixtureCommands(getScene: () => EditorScene, { checkpoint, report }: FixtureCommandOptions) {
  const fixtureOf = (room: Studio | undefined, id: string) => room?.fixtures?.find(f => f.id === id);
  /** Why a room with this fixture could not be built, or null: the room's rules, then the furniture standing there. */
  function problem(next: Studio, f: StudioFixture | undefined): string | null {
    const first = studioProblems(next)[0];
    if (first) return first;
    const solids = createCabinetGeometry(() => [], () => studioObstacles(next));
    return getScene().wardrobes.some(c => solids.cabinetCollides(c)) ? `A wardrobe or cabinet stands in the way${f ? ' of the ' + name(f.kind) : ''}. Move it first.` : null;
  }
  function commit(next: Studio) {
    checkpoint();
    getScene().studio = next;
  }

  /** Adds a fixture of `kind`, fitted the way its kind starts (a toilet wall-hung, in a half-height boxing): on `wallId`
   * near `near` along it, else at the free spot nearest the wall's middle, else on the longest wall with room. Its id,
   * or null with the reason. */
  function addStudioFixture(kind: string, wallId?: string, near?: number): string | null {
    const room = getScene().studio, k = fixtureKind(kind);
    if (!k) return null;
    if (!room?.walls.length) { report(`Add walls first, then the ${name(kind)}.`); return null; }
    const walls = wallId ? room.walls.filter(w => w.id === wallId)
      : room.walls.slice().sort((p, q) => (wallLine(room, q)?.length ?? 0) - (wallLine(room, p)?.length ?? 0));
    let reason: string | null = null;
    for (const strict of [true, false]) for (const w of walls) {
      const face = wallFace(room, w);
      if (!face) continue;
      const preferred = near ?? (face.start + face.end) / 2;
      for (const s of spots(preferred, face.start, face.end)) {
        const placed = addFixture(room, w.id, kind, s);
        if (!placed) continue;
        const f = placed.fixtures!.at(-1)!;
        // Cheap first: the fixture alone on its wall, then the whole room with its boxing.
        if (fixtureProblems(placed, f).length || (strict && straddles(placed, f))) continue;
        const fitted: Result | null = k.setups && k.start ? applySetup(placed, f.id, k.start) : { studio: placed };
        if (!fitted) continue;
        const why = problem(fitted.studio, f);
        if (why) { reason ??= why; continue; }
        commit(fitted.studio);
        return f.id;
      }
    }
    report(wallId ? `This wall has no free stretch for a ${name(kind)}. Move a door, a wardrobe or another fixture, or choose another wall.`
      : reason ?? `No wall has room for a ${name(kind)}.`);
    return null;
  }

  /** Commits an edit to a fixture. `recordHistory` false is a live preview during a drag or a scrub (the gesture takes
   * one checkpoint itself); `quiet` previews skip the message. Refused with the reason. */
  function editFixture(id: string, edit: (room: Studio) => Studio | null | Result, recordHistory = true, quiet = false): boolean {
    const room = getScene().studio;
    if (!room) return false;
    const out = asResult(edit(room));
    if (!out) return false;
    const next = out.studio, why = problem(next, fixtureOf(next, id) ?? fixtureOf(room, id));
    if (why) { if (!quiet) report(why); return false; }
    const changed = JSON.stringify(next) !== JSON.stringify(room);
    if (changed) {
      if (recordHistory) checkpoint();
      getScene().studio = next;
    }
    if (!quiet && out.note) report(out.note);
    return changed;
  }

  /** Fits it the way a setup says (type and boxing). */
  function setFixtureSetup(id: string, setup: string) {
    const ok = editFixture(id, room => applySetup(room, id, setup) ?? null);
    if (!ok && !applySetup(getScene().studio!, id, setup)) report('There is no room for a boxing here. Move it along the wall first.');
    return ok;
  }

  /** A copy beside it on the same wall, nearest first on the right. Its id, or null with the reason. */
  function duplicateStudioFixture(id: string): string | null {
    const room = getScene().studio, f = fixtureOf(room, id), w = f && room?.walls.find(x => x.id === f.wall), face = room && w && wallFace(room, w);
    if (!room || !f || !face) return null;
    for (const s of spots(f.offset, face.start, face.end).filter(s => Math.abs(s - f.offset) >= f.width)) {
      const next = duplicateFixture(room, id, s);
      if (next && !problem(next, f)) { commit(next); return next.fixtures!.at(-1)!.id; }
    }
    report(`There is no room for another ${name(f.kind)} on this wall.`);
    return null;
  }

  function removeStudioFixture(id: string) {
    return editFixture(id, room => removeFixture(room, id));
  }

  /** Why a room with fixture `id` as it is in `next` could not be built, or null. Changes nothing: drags use it to go as far as the room allows. */
  const fixtureProblem = (next: Studio, id: string) => problem(next, fixtureOf(next, id));

  return { addStudioFixture, editFixture, fixtureProblem, setFixtureSetup, duplicateStudioFixture, removeStudioFixture };
}
