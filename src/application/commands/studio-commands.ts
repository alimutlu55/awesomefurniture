import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { createStudio, studioTemplate } from '../../domain/studio/studio-templates';
import type { StudioTemplateId } from '../../domain/studio/studio-templates';
import { translateStudio } from '../../domain/studio/studio-edit';
import { studioProblems } from '../../domain/studio/studio-validation';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { placeAgainstWall, pushOutOfWalls, snapToWall } from '../../domain/studio/studio-placement';
import type { Pose } from '../../domain/studio/studio-placement';
import type { Studio } from '../../domain/studio/studio';

interface StudioCommandOptions {
  checkpoint: () => void;
  discardCheckpoint: () => void;
  report: (message: string) => void;
}

/** Room commands: place a built-in studio, edit its walls, and keep wardrobes out of the walls.
 * Every change is checked before it is committed and refused with a reason. */
export function createStudioCommands(getScene: () => EditorScene, { checkpoint, report }: StudioCommandOptions) {
  /** Collision against a given room (the current one, or one being considered). */
  const collisionWith = (room: Studio | undefined, others: () => readonly EditorCabinet[]) => createCabinetGeometry(others, () => studioObstacles(room));
  const footprint = (c: EditorCabinet) => ({ w: c.state.w, d: c.state.d });
  /** Wardrobes that a room's walls would cut through. */
  const blockedBy = (room: Studio) => {
    const walls = collisionWith(room, () => []);
    return getScene().wardrobes.filter(c => walls.cabinetCollides(c));
  };

  /** Puts a built-in studio around the wardrobes: its wardrobe wall behind them, centred on them.
   * Wardrobes caught in a wall move out to the room side. Refused if they cannot all fit. */
  function placeStudio(id: StudioTemplateId | 'none') {
    const scene = getScene();
    if (id === 'none') {
      if (!scene.studio) return false;
      checkpoint();
      delete scene.studio;
      report('Room removed. Wardrobes stand on an open floor.');
      return true;
    }
    if (id === 'custom' || !studioTemplate(id)) return false;
    const bounds = createCabinetGeometry(() => scene.wardrobes).sceneBounds();
    const room = translateStudio(createStudio(id), Math.round(bounds.x * 10) / 10, Math.round((bounds.z - bounds.d / 2) * 10) / 10);
    const poses = new Map<number, Pose>();
    for (const cabinet of scene.wardrobes) {
      const others = () => scene.wardrobes.filter(o => o.id !== cabinet.id).map(o => ({ ...o, ...poses.get(o.id) }));
      const collision = collisionWith(room, others);
      const freed = pushOutOfWalls(room, cabinet, footprint(cabinet), pose => collision.cabinetCollides({ ...cabinet, ...pose }));
      if (!freed) {
        report('Your wardrobes do not fit in this room. Choose a bigger room, or move them apart first.');
        return false;
      }
      if (freed.x !== cabinet.x || freed.z !== cabinet.z) poses.set(cabinet.id, freed);
    }
    checkpoint();
    scene.studio = room;
    for (const cabinet of scene.wardrobes) Object.assign(cabinet, poses.get(cabinet.id) ?? {});
    report(studioTemplate(id)!.name + (poses.size ? ` · ${poses.size === 1 ? 'a wardrobe was' : poses.size + ' wardrobes were'} moved out of the wall` : ''));
    return true;
  }

  /** Checks a candidate without mutating the scene or reporting a toast, for live drag feedback. */
  function studioEditProblem(next: Studio | null): string | null {
    if (!next) return 'This edit does not fit. Choose another position or a longer wall.';
    const problem = studioProblems(next)[0];
    if (problem) return problem;
    if (blockedBy(next).length) return 'A wardrobe is in the way. Move it before moving this wall.';
    return null;
  }

  /** Commits an edit to the room. `recordHistory` false is a live preview during a drag (the drag
   * takes one checkpoint when it starts). Refused, with the reason, if the room would not be valid or
   * a wall would cut through a wardrobe. */
  function editStudio(edit: (room: Studio) => Studio | null, recordHistory = true) {
    const scene = getScene();
    if (!scene.studio) return false;
    const next = edit(scene.studio);
    const problem = studioEditProblem(next);
    if (problem) { report(problem); return false; }
    if (!next) return false;
    if (JSON.stringify(next) === JSON.stringify(scene.studio)) return false;
    if (recordHistory) checkpoint();
    scene.studio = next;
    return true;
  }

  /** Where a new wardrobe goes in the room: flush against the first free wall, facing in. Null when
   * there is no room (or no studio), so the caller places it beside the others. */
  function placeNewCabinet(cabinet: EditorCabinet): Pose | null {
    const room = getScene().studio;
    if (!room) return null;
    const collision = collisionWith(room, () => getScene().wardrobes);
    return placeAgainstWall(room, footprint(cabinet), pose => collision.cabinetCollides({ ...cabinet, ...pose }));
  }

  /** The flush, square pose against a wall for a wardrobe being dragged near it, if it is free. */
  function wallSnap(cabinet: EditorCabinet, pose: Pose): Pose | null {
    const room = getScene().studio;
    if (!room) return null;
    const snapped = snapToWall(room, pose, footprint(cabinet));
    if (!snapped) return null;
    const collision = collisionWith(room, () => getScene().wardrobes);
    return collision.cabinetCollides({ ...cabinet, ...snapped }) ? null : snapped;
  }

  return { placeStudio, editStudio, studioEditProblem, placeNewCabinet, wallSnap };
}
