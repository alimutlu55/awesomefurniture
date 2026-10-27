import { expandedEndPanels } from '../../domain/kitchen/explicit-panel-fit';
import { ceilingClearance } from '../../domain/studio/studio-clearance';
import { resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { endPanelDesign, rememberEndPanels } from '../../domain/kitchen/end-panels';
import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { createKitchenCover, createKitchenDesign, kitchenPreset } from '../../domain/kitchen/kitchen-design';
import { isFixture, kitchenUnit, type KitchenUnitKey } from '../../domain/kitchen/kitchen-units';
import { arrayPoses, besidePanel, besidePose, isKitchenUnit, runOf as runOfUnit, stackedPose, unitAxes, type Pose } from '../../domain/kitchen/kitchen-runs';
import { furnitureModule } from '../../domain/furniture/furniture';
import { fitting } from '../../domain/wardrobe/fittings';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { applyMaxReach } from '../../domain/wardrobe/max-reach';
import { roomHeight, wallLine } from '../../domain/studio/studio';
import { CEILING_CLEARANCE_TOLERANCE } from '../../domain/studio/studio-clearance';
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
  const maxTop = () => Math.max(
    getScene().studio ? roomHeight(getScene().studio!) + CEILING_CLEARANCE_TOLERANCE : Infinity,
    (active()?.y || 0) + (active()?.state.h || 0) + .01,
  );
  const fits = (candidate: EditorCabinet) => !collision.cabinetCollides(candidate)
    && (!getScene().studio || (candidate.y || 0) + candidate.state.h <= maxTop())
    && expandedEndPanels([...getScene().wardrobes.filter(p => p.id !== candidate.id), candidate]).filter(p => p.state.unit === 'end-panel')
      .every(p => !ceilingClearance(getScene().studio, { ...p, w: p.state.w, d: p.state.d }, 1e-5)(resolveShape(p.state)));
  // Preserve contact exactly: rounding a pose can nudge a copy into the original or the wall.
  const at = (cabinet: EditorCabinet, pose: Pose): EditorCabinet => ({ ...cabinet, ...pose });

  /** The unit a new one goes next to: the selected kitchen unit, else the one added last. */
  function anchorFor(): EditorCabinet | null {
    const selected = active();
    if (selected && !isFixture(selected.state)) return selected;
    return [...getScene().wardrobes].reverse().find(isKitchenUnit) ?? null;
  }

  const unitsAt = (y: number) => getScene().wardrobes.filter(c => isKitchenUnit(c) && (y < .5 ? Math.abs(c.y || 0) < .5 : (c.y || 0) >= .5));
  /** The run a unit stands in, left to right. */
  const runOf = (unit: EditorCabinet) => runOfUnit(getScene().wardrobes, unit) as EditorCabinet[];

  /** Spots at the two ends of the run a unit stands in: after its right end first. */
  function besideRun(unit: EditorCabinet, cabinet: EditorCabinet, y: number): Pose[] {
    const run = runOf(unit);
    return [besidePanel(run[run.length - 1]!, cabinet, 1, y), besidePanel(run[0]!, cabinet, -1, y)];
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
    for (const p of expandedEndPanels(scene.wardrobes)) if (p.state.unit === 'end-panel') {
      const original = scene.wardrobes.find(q => q.id === p.id)!; Object.assign(original, { x: p.x, y: p.y, z: p.z, state: p.state });
    }
    rememberEndPanels(scene.wardrobes);
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
      if (preset.unit === 'end-panel' && anchor) {
        if (anchor.state.unit === 'end-panel') { scene.activeWardrobe = anchor.id; return anchor; }
        for (const side of [1, -1] as const) {
          const inherited = { ...endPanelDesign(anchor.state, side), sel: 0, item: -1, divider: -1, space: null, open: false };
          const panel = { ...fresh, state: inherited, ...besidePose(anchor, inherited.w, inherited.d, side, anchor.y) };
          if (fits(panel)) return add(panel);
        }
        return keep(null, preset.name);
      }
      const near = anchor ? placeNear(anchor, structuredClone(fresh)) : null;
      if (beside || !wall || !studio) return keep(near ?? placeAlone(fresh, spot), preset.name);
      // On the wall in view: beside the kitchen already against it (the unit nearest the point in view), else in front of the viewer.
      const line = wallLine(studio, studio.walls.find(w => w.id === wall)!), alongOf = (c: EditorCabinet) => line ? (c.x - line.a.x) * line.ux + (c.z - line.a.z) * line.uz : 0;
      const onWall = scene.wardrobes.filter(c => isKitchenUnit(c) && standsAgainst(studio, wall, c, c.state))
        .sort((p, q) => Math.abs(alongOf(p) - (spot.placementAlong ?? alongOf(p))) - Math.abs(alongOf(q) - (spot.placementAlong ?? alongOf(q))));
      const local = onWall.map(c => placeNear(c, structuredClone(fresh))).find(c => !!c && standsAgainst(studio, wall, c, c.state)) ?? null;
      return keep(local ?? placeAlone(structuredClone(fresh), spot) ?? near ?? placeAlone(fresh), preset.name);
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
      rememberEndPanels(scene.wardrobes);
      scene.nextWardrobeId += copies.length;
      return copies.length;
    },
    /**
     * Extends the selected unit's run by one step on `side` (what clicking the `+` grip does):
     * 1. If a full-width copy fits and its front is not blocked by a perpendicular kitchen run, places that copy.
     * 2. If at least 30 cm is free in front of any perpendicular run, fits a narrower cabinet (`30..w cm`) into that space.
     * 3. Otherwise, if at least 5 cm is free (either a narrow end-of-run gap `< 30 cm` or a dead corner pocket behind a
     *    perpendicular kitchen run), fits a flush Corner / Filler cover (`createKitchenCover`) that carries the continuous
     *    worktop and plinth into the corner or to the wall.
     */
    extendKitchenRun(side: 1 | -1, recordHistory = true): EditorCabinet | null {
      const scene = getScene(), original = active();
      if (!original || !isKitchenUnit(original)) return null;
      const run = runOf(original), end = side > 0 ? run[run.length - 1]! : run[0]!, y = original.y || 0, d = original.state.d;
      const probeAt = (w: number): EditorCabinet => at({ ...original, id: scene.nextWardrobeId, state: { ...original.state, w } }, besidePanel(end, { ...original, state: { ...original.state, w } }, side, y));
      const fitsWidth = (w: number) => w >= .1 && fits(probeAt(w));
      const isPerpCabinet = (o: EditorCabinet, angle: number) =>
        o.id !== original.id && o.id !== end.id && isKitchenUnit(o) && !isFixture(o.state)
        && Math.abs(((o.angle - angle) % 360 + 540) % 360 - 180) > 15;
      const blockedInFront = (w: number) => {
        const p = probeAt(w), { v } = unitAxes(p.angle), front = { ...p, x: p.x + v.x * 20, z: p.z + v.z * 20, state: { ...p.state, w: Math.max(4, w - 2) } };
        return scene.wardrobes.some(o => isPerpCabinet(o, p.angle) && collision.cabinetOverlaps(front, o));
      };
      const farEdgeBlocked = (w: number) => {
        const p = probeAt(w), { u, v } = unitAxes(p.angle);
        const point = { x: p.x + u.x * side * w / 2 + v.x * 20, z: p.z + u.z * side * w / 2 + v.z * 20 };
        // Test the exact far edge inclusively; an infinitesimally thin box depends on collision tolerance.
        return scene.wardrobes.some(o => {
          if (!isPerpCabinet(o, p.angle) || o.y >= y + p.state.h || o.y + o.state.h <= y) return false;
          const axes = unitAxes(o.angle), dx = point.x - o.x, dz = point.z - o.z;
          let lo = -p.state.d / 2, hi = p.state.d / 2;
          for (const [axis, half] of [[axes.u, o.state.w / 2], [axes.v, o.state.d / 2]] as const) {
            const offset = dx * axis.x + dz * axis.z, velocity = v.x * axis.x + v.z * axis.z;
            if (Math.abs(velocity) < 1e-9) { if (Math.abs(offset) > half + 1e-7) return false; }
            else {
              const a = (-half - offset) / velocity, b = (half - offset) / velocity;
              lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
            }
          }
          return hi >= lo - 1e-7;
        });
      };
      if (fitsWidth(original.state.w) && !blockedInFront(original.state.w)) {
        return this.arrayKitchenUnit(1, side, recordHistory) ? scene.wardrobes[scene.wardrobes.length - 1]! : null;
      }
      let clearW = 0, unblockedW = 0, pocketW = 0;
      const maxSearch = Math.max(original.state.w, 65);
      for (let w = .1; w <= maxSearch + .01; w = Math.round((w + .1) * 10) / 10) {
        if (!fitsWidth(w)) continue;
        if (w <= original.state.w) clearW = w;
        if (w <= original.state.w && !blockedInFront(w)) unblockedW = w;
        if (farEdgeBlocked(w)) pocketW = w;
      }
      if (unblockedW >= 30) {
        const id = scene.nextWardrobeId, state = copyOf(original);
        state.w = unblockedW;
        for (const it of state.secs[0]!) if ((fitting(it.k)?.minWidth ?? 0) > unblockedW - 2 * PANEL) it.k = 'cupboard';
        const narrowed = at({ ...structuredClone(original), id, name: named(state.unit, id), state }, besidePanel(end, { ...original, state: { ...original.state, w: unblockedW } }, side, y));
        if (!fits(narrowed)) return null;
        if (recordHistory) checkpoint();
        applyMaxReach(narrowed.state, scene.maxReach);
        scene.wardrobes.push(narrowed);
        rememberEndPanels(scene.wardrobes);
        scene.nextWardrobeId = Math.max(scene.nextWardrobeId, id + 1);
        return narrowed;
      }
      const coverW = pocketW >= .1 ? pocketW : clearW;
      if (coverW >= .1) {
        const id = scene.nextWardrobeId;
        const solid = { ...createKitchenDesign('filler'), w: coverW, h: original.state.h, d, fin: original.state.fin, materials: structuredClone(original.state.materials) };
        const state = { ...(coverW < 5 ? solid : createKitchenCover(original.state, coverW)), endPanelSides: undefined, sel: 0, item: -1, divider: -1, space: null, open: false };
        const cover = at({ ...structuredClone(original), id, name: 'Corner cover ' + id, state }, besidePanel(end, { ...original, state }, side, y));
        if (!fits(cover)) return null;
        if (recordHistory) checkpoint();
        applyMaxReach(cover.state, scene.maxReach);
        scene.wardrobes.push(cover);
        rememberEndPanels(scene.wardrobes);
        scene.nextWardrobeId = Math.max(scene.nextWardrobeId, id + 1);
        return cover;
      }
      return null;
    },
  };
}

