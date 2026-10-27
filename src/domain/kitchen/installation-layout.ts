import { automaticInstallationParts } from './automatic-installation';
import { endPanelThickness, type PanelPose } from './end-panels';
import { matchingPanelLine } from './shared-panels';
import { installationSolid, localSolid } from './installation-parts';
import { unitAxes, RUN_TOLERANCE } from './kitchen-runs';
import { installationKind, isFixture, kitchenUnit } from './kitchen-units';
import { cabinetBoards } from '../drawings/cabinet-boards';
import { cornerCabinetWidths } from './corner-widths';
import { createCabinetGeometry } from '../geometry/cabinet-geometry.js';
import { worktopThickness } from '../materials/configured-materials';
import type { EditorDesign } from '../wardrobe/editor-design';

export type InstallationPose = PanelPose<EditorDesign>;
const EPS = 1e-7;
const geometry = createCabinetGeometry(() => []);
const sameDirection = (a: PanelPose, b: PanelPose) => Math.abs(Math.sin((a.angle - b.angle) * Math.PI / 180)) < EPS
  && Math.cos((a.angle - b.angle) * Math.PI / 180) > 0;
const normal = (p: InstallationPose) => p.state.product === 'kitchen' && !installationKind(p.state) && !isFixture(p.state);
const at = (p: PanelPose, axis: { x: number; z: number }) => p.x * axis.x + p.z * axis.z;
const vertical = (a: PanelPose, b: PanelPose) => (a.y ?? 0) < (b.y ?? 0) + b.state.h - EPS && (b.y ?? 0) < (a.y ?? 0) + a.state.h - EPS;

/** A floor run carries its aligned upper row with it, preserving appliance/upper alignment.
 * Include explicit separators and supported fixtures. Editing an upper row never shifts the floor row. */
function run<T extends InstallationPose>(boxes: T[], seed: T, blocked = new Set<number | string>()) {
  const { u, v } = unitAxes(seed.angle), members = new Set<T>([seed]);
  for (let n = 0; n < boxes.length; n++) {
    const before = members.size;
    for (const b of boxes) {
      if (blocked.has(b.id) || isFixture(b.state) || members.has(b) || ((seed.y ?? 0) >= .5 && (b.y ?? 0) < .5)) continue;
      if (b.state.product !== seed.state.product || !sameDirection(b, seed)
        || Math.abs(at(b, v) - b.state.d / 2 - at(seed, v) + seed.state.d / 2) > RUN_TOLERANCE) continue;
      if ([...members].some(a => Math.abs(at(a, u) - at(b, u)) - (a.state.w + b.state.w) / 2
        <= endPanelThickness(a.state) + endPanelThickness(b.state) + EPS)) members.add(b);
    }
    if (members.size === before) break;
  }
  for (const f of boxes.filter(p => kitchenUnit(p.state.unit).fixture === 'sink' || kitchenUnit(p.state.unit).fixture === 'hob')) {
    if ([...members].some(p => Math.abs((f.y ?? 0) - (p.y ?? 0) - p.state.h - worktopThickness(p.state)) < .01
      && Math.abs(at(f, u) - at(p, u)) <= p.state.w / 2 + EPS && Math.abs(at(f, v) - at(p, v)) <= p.state.d / 2 + EPS)) members.add(f);
  }
  return members;
}
function shift<T extends InstallationPose>(members: Set<T>, dir: { x: number; z: number }, distance: number) {
  for (const p of members) { p.x += dir.x * distance; p.z += dir.z * distance; }
}
/** Exact positive translation needed to leave an intersecting OBB, from its separating axes. */
function exitDistance(a: PanelPose, b: PanelPose, dir: { x: number; z: number }) {
  if (!geometry.cabinetOverlaps(a, b)) return 0;
  let distance = Infinity;
  for (const axis of [...geometry.cabinetAxes(a), ...geometry.cabinetAxes(b)]) {
    const velocity = dir.x * axis.x + dir.z * axis.z;
    if (Math.abs(velocity) < EPS) continue;
    const offset = at(a, axis) - at(b, axis), radius = geometry.cabinetRadius(a, axis) + geometry.cabinetRadius(b, axis);
    distance = Math.min(distance, (Math.sign(velocity) * radius - offset) / velocity);
  }
  return distance;
}
const fronts = (p: InstallationPose, boxes: InstallationPose[]) => normal(p)
  ? cabinetBoards(p.state, cornerCabinetWidths(p, boxes)).filter(b => b.z0 >= p.state.d - EPS).map(b => localSolid(p, b)) : [];

/** Plan before committing: preserve module dimensions and internal run spacings. The caller validates room
 * constraints atomically. This is an installation reconciliation, never a pointer-movement snap. */
export function planInstallationLayout<T extends InstallationPose>(input: readonly T[], obstacles: readonly PanelPose[] = []) {
  const boxes = structuredClone([...input]), removed = new Map<number | string, number | string>();
  // Explicit double separators: keep the first board and close exactly the removed board's width.
  for (const a of [...boxes]) for (const b of [...boxes]) {
    if (a === b || !boxes.includes(a) || !boxes.includes(b) || installationKind(a.state) !== 'end-panel'
      || installationKind(b.state) !== 'end-panel' || !matchingPanelLine(a, b) || Math.abs(a.state.w - b.state.w) > EPS
      || a.state.fin !== b.state.fin || JSON.stringify(a.state.materials) !== JSON.stringify(b.state.materials)) continue;
    const { u } = unitAxes(a.angle), distance = at(b, u) - at(a, u);
    if (distance < -EPS || distance > a.state.w + EPS) continue;
    const index = boxes.indexOf(b); boxes.splice(index, 1); removed.set(b.id, a.id);
    for (const [id, target] of removed) if (target === b.id) removed.set(id, a.id);
    const { v } = unitAxes(a.angle);
    const after = boxes.filter(p => at(p, u) > at(b, u) + EPS && vertical(p, a) && sameDirection(p, a)
      && Math.abs(at(p, v) - p.state.d / 2 - at(a, v) + a.state.d / 2) < EPS);
    const next = after.filter(p => !isFixture(p.state)).sort((p, q) => at(p, u) - at(q, u))[0];
    if (next && at(next, u) - next.state.w / 2 - at(b, u) - b.state.w / 2 <= RUN_TOLERANCE) shift(run(boxes, next, new Set(boxes.filter(p => at(p, u) <= at(a, u) + EPS).map(p => p.id))), u, -distance);
  }
  // Facing automatic end panes share one stock thickness. Preserve deliberate clearance beyond it.
  for (const a of boxes.filter(normal)) for (const b of boxes.filter(normal)) {
    const { u, v } = unitAxes(a.angle), gap = at(b, u) - at(a, u) - (a.state.w + b.state.w) / 2;
    if (gap <= RUN_TOLERANCE + EPS || gap > 2 * endPanelThickness(a.state) + EPS
      || Math.abs(endPanelThickness(a.state) - endPanelThickness(b.state)) > EPS
      || Math.abs(at(a, v) - at(b, v)) > EPS || !matchingPanelLine(a, b)
      || a.state.fin !== b.state.fin || JSON.stringify(a.state.materials) !== JSON.stringify(b.state.materials)) continue;
    const width = endPanelThickness(a.state);
    if (gap >= width - EPS && Math.abs(gap - 2 * width) > EPS) continue;
    const blocked = new Set(boxes.filter(p => at(p, u) <= at(a, u) + EPS).map(p => p.id));
    shift(run(boxes, b, blocked), u, width - gap);
  }
  // A strip is additional to its owner's nominal width. Reserve its envelope AND its actual front stock,
  // checking the neighbouring finished fronts as well as carcasses. No millimetre stepping or rounding.
  for (let iteration = 0; iteration < boxes.length * 4 + 4; iteration++) {
    let changed = false;
    for (const strip of automaticInstallationParts(boxes).filter(p => p.state.unit === 'filler')) {
      const owner = boxes.find(p => p.id === strip.ownerId)!;
      const members = run(boxes, owner), { u } = unitAxes(owner.angle), dir = { x: -strip.side * u.x, z: -strip.side * u.z };
      let distance = 0;
      for (const other of boxes.filter(p => !members.has(p) && !isFixture(p.state))) {
        for (const solid of [installationSolid(other), ...fronts(other, boxes)]) {
          distance = Math.max(distance, exitDistance(installationSolid(strip), solid, dir));
          distance = Math.max(distance, exitDistance(strip, solid, dir));
        }
      }
      if (!Number.isFinite(distance)) return { boxes: structuredClone([...input]), removed: new Map<number | string, number | string>(), valid: false };
      if (distance > EPS) { shift(members, dir, distance); changed = true; }
    }
    for (const panel of automaticInstallationParts(boxes)) {
      const owner = boxes.find(p => p.id === panel.ownerId)!, { u } = unitAxes(owner.angle);
      const dir = { x: -panel.side * u.x, z: -panel.side * u.z };
      const distance = Math.max(0, ...obstacles.flatMap(wall => [exitDistance(panel, wall, dir), exitDistance(installationSolid(panel), wall, dir)]));
      if (!Number.isFinite(distance) || distance > panel.state.w + EPS)
        return { boxes: structuredClone([...input]), removed: new Map<number | string, number | string>(), valid: false };
      if (distance > EPS) { shift(run(boxes, owner), dir, distance); changed = true; }
    }
    if (!changed) return { boxes, removed, valid: true };
  }
  return { boxes: structuredClone([...input]), removed: new Map<number | string, number | string>(), valid: false };
}
