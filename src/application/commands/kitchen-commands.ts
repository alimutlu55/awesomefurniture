import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { createKitchenDesign, kitchenPreset } from '../../domain/kitchen/kitchen-design';
import { kitchenUnit, type KitchenUnitKey } from '../../domain/kitchen/kitchen-units';
import { arrayPoses, besidePose, isKitchenUnit, kitchenRuns, stackedPose, type Pose } from '../../domain/kitchen/kitchen-runs';
import { furnitureModule } from '../../domain/furniture/furniture';
import { roomHeight } from '../../domain/studio/studio';

interface KitchenCommandOptions {
  checkpoint?: () => void;
  report?: (message: string) => void;
  /** Places a cabinet that has no kitchen neighbour, the way a new wardrobe is placed (in a room: against a free wall). */
  placeAlone: (cabinet: EditorCabinet) => EditorCabinet | null;
}

/**
 * Kitchen units go together: a new unit stands beside the selected one (or the last one added), a wall unit
 * hangs over a base unit, and duplicates line up along the run. Each add is one undo step.
 */
export function createKitchenCommands(getScene: () => EditorScene, { checkpoint = () => {}, report = () => {}, placeAlone }: KitchenCommandOptions) {
  const collision = createCabinetGeometry(() => getScene().wardrobes, () => studioObstacles(getScene().studio));
  const active = () => getScene().wardrobes.find(w => w.id === getScene().activeWardrobe);
  const fits = (candidate: EditorCabinet) => !collision.cabinetCollides(candidate)
    && (!getScene().studio || (candidate.y || 0) + candidate.state.h <= roomHeight(getScene().studio!) + .01);
  const at = (cabinet: EditorCabinet, pose: Pose): EditorCabinet => ({ ...cabinet, x: round(pose.x), y: round(pose.y), z: round(pose.z), angle: pose.angle });

  /** The unit a new one goes next to: the selected kitchen unit, else the one added last. */
  function anchorFor(): EditorCabinet | null {
    const selected = active();
    if (selected && isKitchenUnit(selected)) return selected;
    return [...getScene().wardrobes].reverse().find(isKitchenUnit) ?? null;
  }

  const unitsAt = (y: number) => getScene().wardrobes.filter(c => isKitchenUnit(c) && Math.abs((c.y || 0) - y) < .5);
  /** The run a unit stands in, left to right. */
  const runOf = (unit: EditorCabinet) => kitchenRuns(unitsAt(unit.y || 0)).find(r => r.some(c => c.id === unit.id)) ?? [unit];

  /** Spots at the two ends of the run a unit stands in: after its right end first. */
  function besideRun(unit: EditorCabinet, cabinet: EditorCabinet, y: number): Pose[] {
    const run = runOf(unit);
    return [besidePose(run[run.length - 1]!, cabinet.state.w, cabinet.state.d, 1, y), besidePose(run[0]!, cabinet.state.w, cabinet.state.d, -1, y)];
  }

  /** Where a new unit can stand next to `anchor`: a wall unit over it (or over its run) first, then along the
   * units already at its own height; a floor unit at the end of the anchor's run. */
  function placeNear(anchor: EditorCabinet, cabinet: EditorCabinet): EditorCabinet | null {
    const y = kitchenUnit(cabinet.state.unit).elevation, spots: Pose[] = [];
    if (Math.abs((anchor.y || 0) - y) > .5) {
      for (const c of [anchor, ...runOf(anchor)]) spots.push(stackedPose(c, cabinet.state.d, y));
      for (const c of unitsAt(y).reverse()) spots.push(...besideRun(c as EditorCabinet, cabinet, y));
    } else spots.push(...besideRun(anchor, cabinet, y));
    for (const spot of spots) {
      const candidate = at(cabinet, spot);
      if (fits(candidate)) return candidate;
    }
    return null;
  }

  function add(cabinet: EditorCabinet): EditorCabinet {
    const scene = getScene();
    checkpoint();
    scene.wardrobes.push(cabinet);
    scene.activeWardrobe = cabinet.id;
    scene.nextWardrobeId = Math.max(scene.nextWardrobeId, cabinet.id + 1);
    return cabinet;
  }

  const named = (unit: KitchenUnitKey | undefined, id: number) => kitchenUnit(unit).name + ' ' + id;

  return {
    /** Adds a unit from a preset (Base cabinet, Sink unit, Wall cabinet...) beside the kitchen it belongs to. */
    addKitchenUnit(presetKey: string): EditorCabinet | null {
      const preset = kitchenPreset(presetKey);
      if (!preset) return null;
      const scene = getScene(), id = scene.nextWardrobeId, state = { ...createKitchenDesign(preset.unit, preset.key), sel: 0, item: -1, divider: -1, space: null, open: false };
      const fresh: EditorCabinet = { id, name: preset.name + ' ' + id, x: 0, y: kitchenUnit(preset.unit).elevation, z: 0, angle: 0, state };
      const anchor = anchorFor(), placed = anchor ? placeNear(anchor, fresh) ?? placeAlone(fresh) : placeAlone(fresh);
      if (!placed) {
        report('The ' + preset.name.toLowerCase() + ' does not fit beside the other cabinets or against a free wall.');
        return null;
      }
      return add(placed);
    },
    /** A copy of the selected unit beside it, with its appliances turned into plain storage. */
    duplicateKitchenUnit(): EditorCabinet | null {
      const original = active();
      if (!original || !isKitchenUnit(original)) return null;
      const id = getScene().nextWardrobeId, state = furnitureModule(original.state).duplicate(original.state);
      const copy: EditorCabinet = { ...structuredClone(original), id, name: named(state.unit, id), state };
      const placed = placeNear(original, copy);
      if (!placed) { report('There is no room for another cabinet beside this one.'); return null; }
      return add(placed);
    },
    /**
     * Copies of the selected unit pulled out from its side (`side` 1: right, -1: left): as many as fit up to
     * `count`, nearest first. Returns how many stand. The caller restores and checkpoints around live previews,
     * like any drag; `recordHistory` false adds them without a checkpoint.
     */
    arrayKitchenUnit(count: number, side: 1 | -1, recordHistory = true): number {
      const scene = getScene(), original = active();
      if (!original || !isKitchenUnit(original) || count < 1) return 0;
      const copies: EditorCabinet[] = [];
      for (const pose of arrayPoses(original, count, side)) {
        const id = scene.nextWardrobeId + copies.length, state = furnitureModule(original.state).duplicate(original.state);
        const copy = at({ ...structuredClone(original), id, name: named(state.unit, id), state }, pose);
        // Copies line up end to end, so each only has to clear the room and the other furniture.
        if (!fits(copy)) break;
        copies.push(copy);
      }
      if (!copies.length) return 0;
      if (recordHistory) checkpoint();
      scene.wardrobes.push(...copies);
      scene.nextWardrobeId += copies.length;
      return copies.length;
    },
  };
}

/** Tidy numbers without moving units apart or into each other. */
const round = (v: number) => Math.round(v * 1e6) / 1e6;
