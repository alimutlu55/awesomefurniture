import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { createKitchenDesign, kitchenPreset } from '../../domain/kitchen/kitchen-design';
import { kitchenUnit, type KitchenUnitKey } from '../../domain/kitchen/kitchen-units';
import { arrayPoses, besidePose, isKitchenUnit, kitchenRuns, stackedPose, type Pose } from '../../domain/kitchen/kitchen-runs';
import { furnitureModule } from '../../domain/furniture/furniture';
import { applyMaxReach } from '../../domain/wardrobe/max-reach';
import { roomHeight, wallLine } from '../../domain/studio/studio';
import { standsAgainst } from '../../domain/studio/studio-placement';

/** Where a new unit goes: against the wall in view from the point in view, or `beside` the selected unit. */
export interface KitchenPlacement { readonly placementWall?: string; readonly placementAlong?: number; readonly beside?: boolean }

interface KitchenCommandOptions {
  checkpoint?: () => void;
  report?: (message: string) => void;
  /** Places a cabinet that has no kitchen neighbour, the way a new wardrobe is placed (in a room: against a free wall). */
  placeAlone: (cabinet: EditorCabinet, placement?: Omit<KitchenPlacement, 'beside'>) => EditorCabinet | null;
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
    applyMaxReach(cabinet.state, scene.maxReach);
    scene.wardrobes.push(cabinet);
    scene.activeWardrobe = cabinet.id;
    scene.nextWardrobeId = Math.max(scene.nextWardrobeId, cabinet.id + 1);
    return cabinet;
  }

  /** Adds a placed unit, or says why there was no room for it. */
  function keep(placed: EditorCabinet | null, name: string): EditorCabinet | null {
    if (placed) return add(placed);
    report('The ' + name.toLowerCase() + ' does not fit beside the other cabinets or against a free wall.');
    return null;
  }

  const named = (unit: KitchenUnitKey | undefined, id: number) => kitchenUnit(unit).name + ' ' + id;
  /** A copy of a unit's design with nothing chosen inside it (no item, divider or space). */
  const copyOf = (original: EditorCabinet) => ({ ...furnitureModule(original.state).duplicate(original.state), item: -1, divider: -1, space: null, open: false });

  return {
    /** Adds a unit from a preset (Base cabinet, Sink unit, Wall cabinet...). Asked `beside` the selected unit, or with no
     * wall in view, it joins the kitchen it belongs to. Otherwise it goes on the wall in view: beside a kitchen standing
     * against that wall, else in front of the viewer; another wall only when the one in view is full. */
    addKitchenUnit(presetKey: string, placement: KitchenPlacement = {}): EditorCabinet | null {
      const preset = kitchenPreset(presetKey);
      if (!preset) return null;
      const scene = getScene(), id = scene.nextWardrobeId, state = { ...createKitchenDesign(preset.unit, preset.key), sel: 0, item: -1, divider: -1, space: null, open: false };
      const fresh: EditorCabinet = { id, name: preset.name + ' ' + id, x: 0, y: kitchenUnit(preset.unit).elevation, z: 0, angle: 0, state };
      const anchor = anchorFor(), { beside, ...spot } = placement, studio = scene.studio, wall = spot.placementWall;
      const near = anchor ? placeNear(anchor, structuredClone(fresh)) : null;
      if (beside || !wall || !studio) return keep(near ?? placeAlone(fresh, spot), preset.name);
      // On the wall in view: beside the kitchen already against it (the unit nearest the point in view), else in front of the viewer.
      const line = wallLine(studio, studio.walls.find(w => w.id === wall)!), alongOf = (c: EditorCabinet) => line ? (c.x - line.a.x) * line.ux + (c.z - line.a.z) * line.uz : 0;
      const onWall = scene.wardrobes.filter(c => isKitchenUnit(c) && standsAgainst(studio, wall, c, c.state))
        .sort((p, q) => Math.abs(alongOf(p) - (spot.placementAlong ?? alongOf(p))) - Math.abs(alongOf(q) - (spot.placementAlong ?? alongOf(q))));
      const local = onWall.map(c => placeNear(c, structuredClone(fresh))).find(c => !!c && standsAgainst(studio, wall, c, c.state)) ?? null;
      return keep(local ?? placeAlone(structuredClone(fresh), spot) ?? near ?? placeAlone(fresh), preset.name);
    },

    /** Room beside the end of the selected unit's run that is narrower than a copy but at least as wide as the narrowest unit:
     * a copy of the unit made as wide as the room allows (whole millimetres), towards `side`. Null when there is no such room. */
    fitUnitInGap(side: 1 | -1, recordHistory = true): EditorCabinet | null {
      const original = active();
      if (!original || !isKitchenUnit(original)) return null;
      const run = runOf(original), end = side > 0 ? run[run.length - 1]! : run[0]!, [narrowest] = kitchenUnit(original.state.unit).sizes.w;
      for (let w = Math.floor((original.state.w - .1) * 10) / 10; w >= narrowest - 1e-9; w = Math.round((w - .1) * 10) / 10) {
        const id = getScene().nextWardrobeId, state = { ...copyOf(original), w };
        const candidate = at({ ...structuredClone(original), id, name: named(state.unit, id), state }, besidePose(end, w, state.d, side, original.y || 0));
        if (!fits(candidate)) continue;
        if (recordHistory) return add(candidate);
        const scene = getScene();
        applyMaxReach(candidate.state, scene.maxReach);
        scene.wardrobes.push(candidate);
        scene.activeWardrobe = id;
        scene.nextWardrobeId = id + 1;
        return candidate;
      }
      return null;
    },

    /** A copy of the selected unit beside it, with its appliances turned into plain storage. */
    duplicateKitchenUnit(): EditorCabinet | null {
      const original = active();
      if (!original || !isKitchenUnit(original)) return null;
      const id = getScene().nextWardrobeId, state = copyOf(original);
      const copy: EditorCabinet = { ...structuredClone(original), id, name: named(state.unit, id), state };
      const placed = placeNear(original, copy);
      if (!placed) { report('There is no room for another cabinet beside this one.'); return null; }
      return add(placed);
    },
    /**
     * Copies of the selected unit pulled out from its run (`side` 1: after its right end, -1: before its left end):
     * as many as fit up to `count`, nearest first. Returns how many stand. The caller restores and checkpoints around live previews,
     * like any drag; `recordHistory` false adds them without a checkpoint.
     */
    arrayKitchenUnit(count: number, side: 1 | -1, recordHistory = true): number {
      const scene = getScene(), original = active();
      if (!original || !isKitchenUnit(original) || count < 1) return 0;
      const copies: EditorCabinet[] = [];
      const run = runOf(original), end = side > 0 ? run[run.length - 1]! : run[0]!;
      for (const pose of arrayPoses(original, count, side, end)) {
        const id = scene.nextWardrobeId + copies.length, state = copyOf(original);
        const copy = at({ ...structuredClone(original), id, name: named(state.unit, id), state }, pose);
        // Copies line up end to end, so each only has to clear the room and the other furniture.
        if (!fits(copy)) break;
        copies.push(copy);
      }
      if (!copies.length) return 0;
      if (recordHistory) checkpoint();
      for (const copy of copies) applyMaxReach(copy.state, scene.maxReach);
      scene.wardrobes.push(...copies);
      scene.nextWardrobeId += copies.length;
      return copies.length;
    },
  };
}

/** Tidy numbers without moving units apart or into each other. */
const round = (v: number) => Math.round(v * 1e6) / 1e6;
