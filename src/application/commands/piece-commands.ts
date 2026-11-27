import { noopAnalytics, type TrackEvent } from '../analytics/analytics-port';
import type { EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { cabinetPiece, furnishingPiece, roomOf, studioPiece } from '../../domain/pieces/pieces';
import type { PieceKey, Pose } from '../../domain/pieces/piece-model';
import { wallFace, wallLine, type Studio, type StudioFixture } from '../../domain/studio/studio';
import { studioProblems } from '../../domain/studio/studio-validation';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { fixtureKind } from '../../domain/studio/fixtures/fixture-kinds';
import { addFixture, duplicateFixture, removeFixture } from '../../domain/studio/fixtures/fixture-edit';
import { applySetup, standsOnFloor } from '../../domain/studio/fixtures/fixture-setup';
import { fixtureProblems } from '../../domain/studio/fixtures/fixture-validation';
import { furnishingKind, startFurnishingType } from '../../domain/studio/furnishings/furnishing-kinds';
import { addFurnishing, duplicateFurnishing, moveFurnishing, removeFurnishing } from '../../domain/studio/furnishings/furnishing-edit';
import { newFurnishingPose } from '../../domain/studio/furnishings/furnishing-place';

interface PieceCommandOptions {
  checkpoint: () => void;
  report: (message: string) => void;
  track?: TrackEvent | undefined;
}
type Family = Exclude<PieceKey['family'], 'cabinet'>;
type Result = { studio: Studio; note?: string | undefined };
type Edit = (studio: Studio) => Studio | Result | null;
const fixtureOf = (studio: Studio | undefined, id: string) => studio?.fixtures?.find(f => f.id === id);
const furnishingOf = (studio: Studio | undefined, id: string) => studio?.furnishings?.find(f => f.id === id);
const fixtureName = (kind: string) => fixtureKind(kind)?.name.toLowerCase() ?? 'fixture';
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
/** Places to try along a wall, nearest `from` first, every 5 cm either way. */
function spots(from: number, start: number, end: number) {
  const out: number[] = [];
  for (let d = 0; d <= end - start; d += 5) for (const s of d ? [from - d, from + d] : [from]) if (s >= start && s <= end) out.push(s);
  return out;
}


/** Validate and save Studio pieces through one command set. The placement search stays specific to how each piece stands. */
export function createPieceCommands(getScene: () => EditorScene, { checkpoint, report, track = noopAnalytics.track }: PieceCommandOptions) {
  const roomWith = (studio: Studio) => roomOf(studio, getScene().wardrobes);

  function problem(next: Studio, key: PieceKey, before?: Studio): string | null {
    const first = studioProblems(next)[0];
    if (first) return first;
    const piece = studioPiece(next, key);
    if (key.family === 'fixture') {
      // The fixture and its boxing may both have moved. Check the cabinets against the whole room.
      const solids = createCabinetGeometry(() => [], () => studioObstacles(next));
      const affected = piece ?? studioPiece(before, key);
      return getScene().wardrobes.some(c => solids.cabinetCollides(c))
        ? `A wardrobe or cabinet stands in the way${affected ? ' of the ' + affected.noun : ''}. Move it first.` : null;
    }
    return piece?.clashes({ studio: next, bodies: getScene().wardrobes.map(c => cabinetPiece(c).body(next)) })[0] ?? null;
  }

  function save(next: Studio, recordHistory: boolean) {
    if (recordHistory) checkpoint();
    getScene().studio = next;
  }

  /** Preview uses the same validation as a commit. The gesture owns its undo checkpoint. */
  function edit(key: PieceKey, change: Edit, recordHistory = true, quiet = false): boolean {
    const studio = getScene().studio, result = studio && change(studio);
    if (!studio || !result) return false;
    const out: Result = 'corners' in result ? { studio: result } : result;
    const why = problem(out.studio, key, studio);
    if (why) { if (!quiet) report(why); return false; }
    const changed = JSON.stringify(out.studio) !== JSON.stringify(studio);
    if (changed) save(out.studio, recordHistory);
    if (!quiet && out.note) report(out.note);
    return changed;
  }

  function creationProblem(next: Studio, family: Family) {
    const item = (family === 'fixture' ? next.fixtures : next.furnishings)!.at(-1)!;
    return problem(next, { family, id: item.id });
  }

  /** Called only for the accepted placement, so probes, previews and failures never count. */
  function created(next: Studio, family: Family): string {
    const item = (family === 'fixture' ? next.fixtures : next.furnishings)!.at(-1)!;
    save(next, true);
    try { track('studio_room_edited', { action: family + '_added', detail_kind: item.kind }); } catch { /* Counting never breaks an edit. */ }
    return item.id;
  }

  const editFixture = (id: string, change: Edit, recordHistory = true, quiet = false) =>
    edit({ family: 'fixture', id }, change, recordHistory, quiet);
  const editFurnishing = (id: string, change: Edit, recordHistory = true, quiet = false) =>
    edit({ family: 'furnishing', id }, change, recordHistory, quiet);
  const fixtureProblem = (next: Studio, id: string) => problem(next, { family: 'fixture', id });
  const furnishingProblem = (next: Studio, id: string) => problem(next, { family: 'furnishing', id });

  /** Adds a fixture of `kind`, fitted the way its kind starts (a toilet wall-hung, in a half-height boxing): on `wallId`
   * near `near` along it, else at the free spot nearest the wall's middle, else on the longest wall with room. Its id,
   * or null with the reason. */
  function addStudioFixture(kind: string, wallId?: string, near?: number): string | null {
    const room = getScene().studio, k = fixtureKind(kind);
    if (!k) return null;
    if (!room?.walls.length) { report(`Add walls first, then the ${fixtureName(kind)}.`); return null; }
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
        const why = creationProblem(fitted.studio, 'fixture');
        if (why) { reason ??= why; continue; }
        return created(fitted.studio, 'fixture');
      }
    }
    report(wallId ? `This wall has no free stretch for a ${fixtureName(kind)}. Move a door, a wardrobe or another fixture, or choose another wall.`
      : reason ?? `No wall has room for a ${fixtureName(kind)}.`);
    return null;
  }

  /** Fits it the way a setup says (type and boxing). */
  function setFixtureSetup(id: string, setup: string) {
    const ok = editFixture(id, room => applySetup(room, id, setup) ?? null);
    if (!ok && !applySetup(getScene().studio!, id, setup)) report('There is no room for a boxing here. Move it along the wall first.');
    return ok;
  }

  function duplicate<P>(family: Family, poses: Iterable<P>, at: (pose: P) => Studio | null, message: string): string | null {
    for (const pose of poses) {
      const next = at(pose);
      if (next && !creationProblem(next, family)) return created(next, family);
    }
    report(message);
    return null;
  }

  /** A copy beside it on the same wall, nearest first on the right. Its id, or null with the reason. */
  function duplicateStudioFixture(id: string): string | null {
    const room = getScene().studio, f = fixtureOf(room, id), w = f && room?.walls.find(x => x.id === f.wall), face = room && w && wallFace(room, w);
    if (!room || !f || !face) return null;
    const offsets = spots(f.offset, face.start, face.end).filter(s => Math.abs(s - f.offset) >= f.width);
    return duplicate('fixture', offsets, s => duplicateFixture(room, id, s), `There is no room for another ${fixtureName(f.kind)} on this wall.`);
  }

  function removeStudioFixture(id: string) {
    return editFixture(id, room => removeFixture(room, id));
  }

  /** The room with a new `kind` at `pose`, or null when it would not fit there. */
  function tryAt(room: Studio, kind: string, pose: Pose): Studio | null {
    const next = addFurnishing(room, kind, pose);
    return next && !creationProblem(next, 'furnishing') ? next : null;
  }

  /** Adds a furnishing of `kind` where its kind goes (a bed against the wall in view near `near`, a bedside table beside
   * a bed, a rug under it). Its id, or null with the reason. */
  function addStudioFurnishing(kind: string, wallId?: string, near?: number): string | null {
    const room = getScene().studio, k = furnishingKind(kind), t = startFurnishingType(kind);
    if (!k || !t) return null;
    if (!room?.walls.length) { report(`Add a room first, then the ${k.name.toLowerCase()}.`); return null; }
    const pose = newFurnishingPose(room, kind, { w: t.size.width, d: t.size.depth }, p => !tryAt(room, kind, p), { wallId, near });
    const next = pose && tryAt(room, kind, pose);
    if (!next) { report(`There is no free floor for a ${k.name.toLowerCase()}. Move a wardrobe or make the room bigger.`); return null; }
    return created(next, 'furnishing');
  }

  /** Turns it to `angle` (snapped unless `free`), or a quarter turn, about its middle: the turn every piece shares, which
   * slides it out of a wall it would turn into. `recordHistory` false is a live preview while a handle is dragged. */
  function turnStudioFurnishing(id: string, angle?: number, free = false, recordHistory = true): boolean {
    const studio = getScene().studio, f = furnishingOf(studio, id);
    if (!studio || !f) return false;
    const piece = furnishingPiece(f), pose = angle === undefined ? piece.quarterTurn(roomWith(studio)) : piece.turn(roomWith(studio), angle, free);
    return editFurnishing(id, r => moveFurnishing(r, id, pose), recordHistory, !recordHistory);
  }

  /** A copy beside it: to its right, its left, in front, else wherever its kind goes. Its id, or null with the reason. */
  function duplicateStudioFurnishing(id: string): string | null {
    const room = getScene().studio, f = furnishingOf(room, id);
    if (!room || !f) return null;
    const piece = furnishingPiece(f), poses = piece.copyPoses(roomWith(room));
    const at = (pose: Pose) => duplicateFurnishing(room, id, pose);
    const candidates = function* () {
      yield* poses;
      const fallback = newFurnishingPose(room, f.kind, { w: f.width, d: f.depth }, pose => {
        const next = at(pose);
        return !next || !!creationProblem(next, 'furnishing');
      });
      if (fallback) yield fallback;
    };
    return duplicate('furnishing', candidates(), at, `There is no room for another ${piece.noun}.`);
  }

  function removeStudioFurnishing(id: string) {
    return editFurnishing(id, room => removeFurnishing(room, id));
  }

  return { addStudioFixture, editFixture, fixtureProblem, setFixtureSetup, duplicateStudioFixture, removeStudioFixture,
    addStudioFurnishing, editFurnishing, furnishingProblem, turnStudioFurnishing, duplicateStudioFurnishing, removeStudioFurnishing };
}
