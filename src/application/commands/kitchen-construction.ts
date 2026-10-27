import { worktopThickness } from '../../domain/materials/configured-materials';
import { unitAxes, kitchenSpans } from '../../domain/kitchen/kitchen-runs';
import type { EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { ceilingClearance } from '../../domain/studio/studio-clearance';
import { resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { plinthOf } from '../../domain/wardrobe/carcass';
import { cornerCabinetWidths } from '../../domain/kitchen/corner-widths';
import { kitchenFrontRect } from '../../domain/kitchen/kitchen-fronts';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { interiorFloorOf } from '../../domain/wardrobe/carcass';
import { kitchenUnit } from '../../domain/kitchen/kitchen-units';

export function createKitchenConstructionCommands(getScene: () => EditorScene, checkpoint: () => void, report: (message: string) => void) {
  return {
    setKitchenConstruction(key: 'plinthHeight' | 'endPanelThickness' | 'cornerStrip' | 'frontThickness' | 'worktopThickness' | 'ventilationWidth' | 'ventilationHeight' | 'fridgeSplit', value: number, recordHistory = true) {
      const scene = getScene(), cabinet = scene.wardrobes.find(p => p.id === scene.activeWardrobe);
      if (!cabinet || cabinet.state.product !== 'kitchen' || !Number.isFinite(value) || value < 0 || value > (key === 'ventilationWidth' ? cabinet.state.w : key === 'fridgeSplit' ? cabinet.state.h : 30)) return false;
      const next = structuredClone(cabinet), state = next.state, requested = Math.round(value * 10) / 10;
      if (key === 'plinthHeight') {
        if (!kitchenUnit(state.unit).plinth) return false;
        const delta = requested - plinthOf(state);
        if (Math.abs(delta) < 1e-8) return false;
        // Preserve carcass and fitting heights: only the support/plinth height and resulting worktop level change.
        state.h += delta;
        if (state.shape) state.shape = { ...state.shape, top: state.shape.top.map(p => ({ ...p, y: p.y + delta })),
          ...(state.shape.back ? { back: state.shape.back.map(y => y + delta) } : {}) };
      } else if (key === 'cornerStrip' && (requested < .1 || requested === state.cornerStrip)) return false;
      else if ((key === 'frontThickness' || key === 'worktopThickness') && requested < .1) return false;
      if (key === 'endPanelThickness' && (requested < .1 || requested > 10)) return false;
      if (key === 'frontThickness' && requested > 5 || key === 'worktopThickness' && requested > 15) return false;
      if (key === 'ventilationHeight' && requested > plinthOf(state)) return false;
      const oldTop = cabinet.state.h + worktopThickness(cabinet.state);
      state[key] = requested;
      const rules = createWardrobeGeometry(() => state), widths = cornerCabinetWidths(next, scene.wardrobes);
      if (key === 'fridgeSplit' && requested > 0) {
        let found = false, valid = true;
        for (let i = 0; i < state.n; i++) rules.computeLayout(i).forEach((pos, j) => {
          const item = state.secs[i]![j]!; if (item.k !== 'fridge') return; found = true;
          const front = kitchenFrontRect(state.unit, 0, pos.y0, pos.w, item.h, { bottom: interiorFloorOf(state), top: state.h - PANEL });
          if (requested >= front.y1 - front.y0) valid = false;
        });
        if (!found || !valid) return false;
      }
      if (key === 'cornerStrip' && widths.some(s => s.covered || s.strip) && !widths.some(s => !s.covered && !s.strip)) {
        report('The corner strip needs a perpendicular return and an exposed front beside it.'); return false;
      }
      const planned = structuredClone(scene);
      planned.wardrobes.find(p => p.id === next.id)!.state = state;
      const collision = createCabinetGeometry(() => planned.wardrobes.filter(p => {
        const kind = kitchenUnit(p.state.unit).fixture; return kind !== 'sink' && kind !== 'hob';
      }), () => studioObstacles(scene.studio));
      const top = resolveShape(state), spans = kitchenSpans(planned.wardrobes);
      const extra = spans.find(s => s.kind === 'worktop' && s.units.includes(next.id))?.height ?? 0;
      const envelope = { ...next, state: { ...state, h: state.h + extra } };
      if (collision.cabinetCollides(envelope) || ceilingClearance(scene.studio, { ...next, w: state.w, d: state.d }, 0)({ ...top,
        top: top.top.map(p => ({ ...p, y: p.y + extra })), ...(top.back ? { back: top.back.map(y => y + extra) } : {}) })
        || Array.from({ length: state.n }, (_, i) => i).some(i => !rules.sectionLayoutValid(i) || rules.overflow(i) > .001)) {
        report('That construction change does not fit the room or the existing fittings.'); return false;
      }
      const lift = state.h + worktopThickness(state) - oldTop, { u, v } = unitAxes(cabinet.angle);
      const supported = scene.wardrobes.filter(p => kitchenUnit(p.state.unit).fixture === 'sink' || kitchenUnit(p.state.unit).fixture === 'hob')
        .filter(p => Math.abs((p.y ?? 0) - (cabinet.y ?? 0) - oldTop) < .01
          && Math.abs((p.x - cabinet.x) * u.x + (p.z - cabinet.z) * u.z) <= state.w / 2
          && Math.abs((p.x - cabinet.x) * v.x + (p.z - cabinet.z) * v.z) <= state.d / 2);
      if (recordHistory) checkpoint();
      cabinet.state = state;
      for (const fixture of supported) fixture.y = (fixture.y ?? 0) + lift;
      return true;
    },
  };
}
