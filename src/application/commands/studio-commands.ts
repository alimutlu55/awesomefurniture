import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { createStudio, studioTemplate } from '../../domain/studio/studio-templates';
import type { StudioTemplateId } from '../../domain/studio/studio-templates';
import { addOpening, suggestWall, translateStudio } from '../../domain/studio/studio-edit';
import { studioProblems } from '../../domain/studio/studio-validation';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { placeAgainstWall, pushOutOfWalls, snapToWall } from '../../domain/studio/studio-placement';
import type { Pose } from '../../domain/studio/studio-placement';
import { wallLine } from '../../domain/studio/studio';
import type { OpeningKind, Studio } from '../../domain/studio/studio';

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

  /** Why a room could not be built as it is, or null. Changes nothing: drags use it to go as far as
   * the room allows. */
  function studioProblem(next: Studio): string | null {
    return studioProblems(next)[0] ?? (blockedBy(next).length ? 'A wardrobe is in the way. Move it before moving this wall.' : null);
  }

  /** Commits an edit to the room. `recordHistory` false is a live preview during a drag (the drag
   * takes one checkpoint when it ends). Refused, with the reason, if the room would not be valid or
   * a wall would cut through a wardrobe. `quiet` previews skip the message; the drag shows it itself. */
  function editStudio(edit: (room: Studio) => Studio | null, recordHistory = true, quiet = false) {
    const scene = getScene();
    if (!scene.studio) return false;
    const next = edit(scene.studio);
    if (!next) return false;
    const problem = studioProblem(next);
    if (problem) { if (!quiet) report(problem); return false; }
    if (JSON.stringify(next) === JSON.stringify(scene.studio)) return false;
    if (recordHistory) checkpoint();
    scene.studio = next;
    return true;
  }

  /** Adds an independent wall with its own corners. With
   * no room yet, a wall behind the wardrobes. Returns the new wall's id, or null with the reason. */
  function addStudioWall(prefer?: string): string | null {
    const room = getScene().studio;
    if (!room || !room.walls.length) {
      const scene = getScene(), bounds = createCabinetGeometry(() => scene.wardrobes).sceneBounds();
      const seed = translateStudio(createStudio('wall'), bounds.x, bounds.z - bounds.d / 2);
      const next: Studio = { ...seed, template: 'custom', walls: seed.walls.map(w => ({ ...w, independent: true })) };
      const problem = studioProblem(next);
      if (problem) { report(problem); return null; }
      checkpoint();
      scene.studio = next;
      return next.walls[0]!.id;
    }
    // Prefer a spot that leaves the wardrobes room to open: no new wall within 70 cm of one.
    const existing = createCabinetGeometry(() => [], () => studioObstacles(room));
    const free = (next: Studio) => {
      const box = studioObstacles(next).at(-1);
      return !!box && !existing.cabinetCollides(box) && !studioProblem(next);
    };
    const clear = (next: Studio) => free(next) && !crowds(next, next.walls.at(-1)!.id);
    const found = suggestWall(room, clear, prefer) ?? suggestWall(room, free, prefer);
    if (!found) { report('There is no free space for another wall. Move a wall or a wardrobe first.'); return null; }
    checkpoint();
    getScene().studio = found.studio;
    return found.wall;
  }

  /** Adds a door, window or archway: to the given wall, or else to the longest wall with room for it
   * where no wardrobe stands in front of it. Returns its id, or null with the reason. */
  function addStudioOpening(kind: OpeningKind, wallId?: string): string | null {
    const room = getScene().studio;
    if (!room) { report('Add a room first, then its doors and windows.'); return null; }
    const name = kind === 'door' ? 'door' : kind === 'window' ? 'window' : 'archway';
    const walls = wallId ? room.walls.filter(w => w.id === wallId) : room.walls.slice().sort((p, q) => (wallLine(room, q)?.length ?? 0) - (wallLine(room, p)?.length ?? 0));
    let fallback: Studio | null = null;
    for (const w of walls) {
      const next = addOpening(room, w.id, kind);
      if (!next || studioProblem(next)) continue;
      if (!inFrontOfOpening(next, next.openings.at(-1)!.id)) return commitOpening(next);
      fallback ??= next;
    }
    if (fallback && wallId) report(`A wardrobe stands in front of this ${name}. Move one of them.`);
    if (fallback) return commitOpening(fallback);
    report(wallId ? `This wall has no room for a ${name}. Make it longer or move an opening.` : `No wall has room for a ${name}.`);
    return null;
  }
  function commitOpening(next: Studio) {
    checkpoint();
    getScene().studio = next;
    return next.openings.at(-1)!.id;
  }
  /** Whether a wall comes within 70 cm of a wardrobe, on either side of it. */
  function crowds(room: Studio, id: string) {
    const box = studioObstacles(room).find(o => o.id === 'wall:' + id);
    if (!box) return false;
    const space = createCabinetGeometry(() => [], () => [{ ...box, state: { ...box.state, d: box.state.d + 140, w: box.state.w + 40 } }]);
    return getScene().wardrobes.some(c => space.cabinetCollides(c));
  }
  /** Whether a wardrobe stands in the half metre in front of an opening, where a person walks or looks. */
  function inFrontOfOpening(room: Studio, id: string) {
    const o = room.openings.find(x => x.id === id), w = o && room.walls.find(x => x.id === o.wall), line = w && wallLine(room, w);
    if (!o || !w || !line) return false;
    const off = w.thickness / 2 + 26, x = line.a.x + line.ux * o.offset + line.nx * off, z = line.a.z + line.uz * o.offset + line.nz * off;
    const space = createCabinetGeometry(() => [], () => [{ id: 'opening', x, y: 0, z, angle: line.angle, state: { w: o.width, d: 50, h: 400 } }]);
    return getScene().wardrobes.some(c => space.cabinetCollides(c));
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

  return { placeStudio, editStudio, studioProblem, addStudioWall, addStudioOpening, placeNewCabinet, wallSnap };
}
