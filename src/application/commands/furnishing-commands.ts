import type { EditorScene } from '../projects/editor-scene';
import type { Studio, StudioFurnishing } from '../../domain/studio/studio';
import { studioProblems } from '../../domain/studio/studio-validation';
import { furnishingKind, startFurnishingType } from '../../domain/studio/furnishings/furnishing-kinds';
import { addFurnishing, duplicateFurnishing, moveFurnishing, removeFurnishing } from '../../domain/studio/furnishings/furnishing-edit';
import { newFurnishingPose } from '../../domain/studio/furnishings/furnishing-place';
import type { Pose } from '../../domain/studio/studio-placement';
import { cabinetPiece, furnishingPiece, roomOf } from '../../domain/pieces/pieces';

interface FurnishingCommandOptions {
  checkpoint: () => void;
  report: (message: string) => void;
}

/** Beds, rugs and the other furnishings: added where there is room for them, moved, turned, changed, copied and
 * removed. Every change is checked by the room's rules and against the wardrobes, and refused with the reason. */
export function createFurnishingCommands(getScene: () => EditorScene, { checkpoint, report }: FurnishingCommandOptions) {
  const furnishingOf = (room: Studio | undefined, id: string) => room?.furnishings?.find(f => f.id === id);
  /** The room as every piece sees it: its walls and shapes, its own pieces and the cabinets standing in it. */
  const roomWith = (studio: Studio | undefined) => roomOf(studio, getScene().wardrobes);
  /** Why a room with furnishing `f` as it is could not be built, or null: the room's rules, then a cabinet in its way
   * (the collision rule every piece shares, met by the cabinets the room's own rules do not know). */
  function problem(next: Studio, f: StudioFurnishing | undefined): string | null {
    const first = studioProblems(next)[0];
    if (first || !f) return first ?? null;
    // The room's own rules passed, so a clash here is with a cabinet.
    return furnishingPiece(f).clashes({ studio: next, bodies: getScene().wardrobes.map(c => cabinetPiece(c).body(next)) })[0] ?? null;
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
    const poses: Pose[] = furnishingPiece(f).copyPoses(roomWith(room));
    const fallback = newFurnishingPose(room, f.kind, { w: f.width, d: f.depth }, p => !copyAt(room, id, p));
    for (const pose of fallback ? [...poses, fallback] : poses) {
      const next = copyAt(room, id, pose);
      if (next) { commit(next); return next.furnishings!.at(-1)!.id; }
    }
    report(`There is no room for another ${furnishingPiece(f).noun}.`);
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
