import type { EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import type { Studio, StudioFurnishing } from '../../domain/studio/studio';
import { studioProblems } from '../../domain/studio/studio-validation';
import { furnishingKind, startFurnishingType } from '../../domain/studio/furnishings/furnishing-kinds';
import { addFurnishing, duplicateFurnishing, removeFurnishing, turnFurnishing } from '../../domain/studio/furnishings/furnishing-edit';
import { furnishingPoint, furnishingSolid, isFlat, newFurnishingPose } from '../../domain/studio/furnishings/furnishing-place';
import { furnishingNoun } from '../../domain/studio/furnishings/furnishing-validation';
import { pushOutOfWalls, type Pose } from '../../domain/studio/studio-placement';
import { wallObstacles } from '../../domain/studio/studio-obstacles';

interface FurnishingCommandOptions {
  checkpoint: () => void;
  report: (message: string) => void;
}

/** Beds, rugs and the other furnishings: added where there is room for them, moved, turned, changed, copied and
 * removed. Every change is checked by the room's rules and against the wardrobes, and refused with the reason. */
export function createFurnishingCommands(getScene: () => EditorScene, { checkpoint, report }: FurnishingCommandOptions) {
  const furnishingOf = (room: Studio | undefined, id: string) => room?.furnishings?.find(f => f.id === id);
  /** Why a room with furnishing `f` as it is could not be built, or null: the room's rules, then a wardrobe in its way. */
  function problem(next: Studio, f: StudioFurnishing | undefined): string | null {
    const first = studioProblems(next)[0];
    if (first) return first;
    if (!f || isFlat(f)) return null;
    const solid = createCabinetGeometry(() => [], () => [furnishingSolid(f)]);
    return getScene().wardrobes.some(c => solid.cabinetCollides(c)) ? `A wardrobe or cabinet stands in the way of the ${furnishingNoun(f)}. Move it first.` : null;
  }
  function commit(next: Studio) {
    checkpoint();
    getScene().studio = next;
  }
  /** The room with a new `kind` at `pose`, or null when it would not fit there. */
  function tryAt(room: Studio, kind: string, pose: Pose): Studio | null {
    const next = addFurnishing(room, kind, pose);
    return next && !problem(next, next.furnishings!.at(-1)) ? next : null;
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
    commit(next);
    return next.furnishings!.at(-1)!.id;
  }

  /** Commits an edit to a furnishing. `recordHistory` false is a live preview during a drag or a scrub (the gesture takes
   * one checkpoint itself); `quiet` previews skip the message. Refused with the reason. */
  function editFurnishing(id: string, edit: (room: Studio) => Studio | null, recordHistory = true, quiet = false): boolean {
    const room = getScene().studio, next = room && edit(room);
    if (!room || !next) return false;
    const why = problem(next, furnishingOf(next, id));
    if (why) { if (!quiet) report(why); return false; }
    const changed = JSON.stringify(next) !== JSON.stringify(room);
    if (changed) {
      if (recordHistory) checkpoint();
      getScene().studio = next;
    }
    return changed;
  }

  /** Turns it a quarter turn about its middle, sliding it out of a wall it would turn into. */
  function turnStudioFurnishing(id: string, by = 90): boolean {
    const room = getScene().studio, f = furnishingOf(room, id);
    if (!room || !f) return false;
    const turned = turnFurnishing(room, id, f.angle + by)!, g = furnishingOf(turned, id)!;
    const walls = createCabinetGeometry(() => [], () => wallObstacles(room));
    const free = pushOutOfWalls(room, g, { w: g.width, d: g.depth }, p => walls.cabinetCollides({ ...p, y: 0, state: { w: g.width, d: g.depth, h: g.height } }));
    const pose = free ?? g;
    return editFurnishing(id, r => turnFurnishing(r, id, pose.angle) && { ...r, furnishings: r.furnishings!.map(x => x.id === id ? { ...x, ...pose } : x) });
  }

  /** A copy beside it: to its right, its left, in front, else wherever its kind goes. Its id, or null with the reason. */
  function duplicateStudioFurnishing(id: string): string | null {
    const room = getScene().studio, f = furnishingOf(room, id);
    if (!room || !f) return null;
    const offsets = [[f.width + 5, 0], [-f.width - 5, 0], [0, f.depth + 5], [0, -f.depth - 5]] as const;
    const poses: Pose[] = offsets.map(([s, t]) => ({ ...furnishingPoint(f, s, t), angle: f.angle }));
    const fallback = newFurnishingPose(room, f.kind, { w: f.width, d: f.depth }, p => !copyAt(room, id, p));
    for (const pose of fallback ? [...poses, fallback] : poses) {
      const next = copyAt(room, id, pose);
      if (next) { commit(next); return next.furnishings!.at(-1)!.id; }
    }
    report(`There is no room for another ${furnishingNoun(f)}.`);
    return null;
  }
  function copyAt(room: Studio, id: string, pose: Pose): Studio | null {
    const next = duplicateFurnishing(room, id, pose);
    return next && !problem(next, next.furnishings!.at(-1)) ? next : null;
  }

  function removeStudioFurnishing(id: string) {
    return editFurnishing(id, room => removeFurnishing(room, id));
  }

  /** Why a room with furnishing `id` as it is in `next` could not be built, or null. Changes nothing: drags use it. */
  const furnishingProblem = (next: Studio, id: string) => problem(next, furnishingOf(next, id));

  return { addStudioFurnishing, editFurnishing, furnishingProblem, turnStudioFurnishing, duplicateStudioFurnishing, removeStudioFurnishing };
}
