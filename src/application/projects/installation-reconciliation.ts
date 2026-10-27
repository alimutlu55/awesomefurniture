import { rememberEndPanels } from '../../domain/kitchen/end-panels';
import { planInstallationLayout } from '../../domain/kitchen/installation-layout';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { automaticInstallationParts } from '../../domain/kitchen/automatic-installation';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { ceilingClearance } from '../../domain/studio/studio-clearance';
import { resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { kitchenSpans } from '../../domain/kitchen/kitchen-runs';
import { isFixture, installationKind } from '../../domain/kitchen/kitchen-units';
import type { EditorScene } from './editor-scene';

/** Validate/merge installation parts on load or drop without relocating furniture. A blocked plan
 * leaves the complete scene untouched; manufacturing validation still identifies the unresolved clash. */
export function reconcileInstallation(scene: EditorScene): boolean {
  const requested = structuredClone(scene.wardrobes);
  rememberEndPanels(requested);
  const plan = planInstallationLayout(requested, studioObstacles(scene.studio));
  if (!plan.valid) return false;
  const originals = new Map(scene.wardrobes.map(p => [p.id, p]));
  const moved = plan.boxes.filter(p => { const old = originals.get(p.id)!; return Math.hypot(p.x - old.x, p.z - old.z) > 1e-7
    || !!installationKind(p.state) && JSON.stringify(p.state) !== JSON.stringify(old.state); });
  const solids = plan.boxes.filter(p => !isFixture(p.state));
  const collision = createCabinetGeometry(() => solids, () => studioObstacles(scene.studio));
  const spans = kitchenSpans([...solids, ...automaticInstallationParts(solids)]);
  if (solids.some(p => collision.cabinetCollides(p))) return false;
  for (const p of moved.filter(p => !isFixture(p.state))) {
    const extra = spans.find(s => s.kind === 'worktop' && s.units.includes(p.id))?.height ?? 0, shape = resolveShape(p.state);
    if (collision.cabinetCollides(p) || ceilingClearance(scene.studio, { ...p, w: p.state.w, d: p.state.d }, 1e-5)({ ...shape,
      top: shape.top.map(q => ({ ...q, y: q.y + extra })), ...(shape.back ? { back: shape.back.map(y => y + extra) } : {}) })) return false;
  }
  // Also protect attached ends whose owner remains still after a separator merge.
  const walls = createCabinetGeometry(() => [], () => studioObstacles(scene.studio));
  const oldParts = automaticInstallationParts(scene.wardrobes);
  if (automaticInstallationParts(plan.boxes).some(p => ceilingClearance(scene.studio, { ...p, w: p.state.w, d: p.state.d }, 1e-5)(resolveShape(p.state)))) return false;
  if (automaticInstallationParts(plan.boxes).some(p => walls.cabinetCollides(p)
    && !oldParts.some(old => old.id === p.id && walls.cabinetCollides(old)))) return false;
  for (const next of plan.boxes) {
    const original = originals.get(next.id)!;
    if (installationKind(next.state) === 'end-panel') original.state = next.state;
    else {
      original.state.endPanelSides = next.state.endPanelSides;
      original.state.leftPanelThickness = next.state.leftPanelThickness;
      original.state.rightPanelThickness = next.state.rightPanelThickness;
    }
    if (installationKind(next.state)) Object.assign(original, { x: next.x, y: next.y ?? 0, z: next.z });
  }
  scene.wardrobes = scene.wardrobes.filter(p => !plan.removed.has(p.id));
  scene.activeWardrobe = Number(plan.removed.get(scene.activeWardrobe) ?? scene.activeWardrobe);
  return true;
}
