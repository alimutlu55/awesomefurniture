import type { EditorDesign } from '../wardrobe/editor-design';
import { cornerStripWidth } from './corner-widths';
import { endPanelThickness, type PanelPose } from './end-panels';
import { kitchenFrontThickness } from './installation-parts';
import { unitAxes } from './kitchen-runs';
import { installationKind, isFixture } from './kitchen-units';

/** Installed stock remaining at the final shared joint. Explicit panes are already ray-test targets. */
export function sidePanelClearance(box: PanelPose, other: PanelPose | undefined, side: -1 | 1) {
  if (other && installationKind(other.state)) return 0;
  if (other) {
    const turn = (other.angle - box.angle) * Math.PI / 180;
    if (Math.abs(Math.sin(turn)) > 1e-7 || Math.cos(turn) < 0) {
      if (box.state.product === 'kitchen' && !installationKind(box.state) && !isFixture(box.state)
        && other.state.product === 'kitchen' && !isFixture(other.state)) {
        const { u } = unitAxes(box.angle), oa = unitAxes(other.angle);
        if (side * (u.x * oa.v.x + u.z * oa.v.z) < -.99) {
          const otherState = other.state as PanelPose['state'] & Partial<Pick<EditorDesign, 'frontThickness' | 'fin' | 'materials'>>;
          return cornerStripWidth(box.state) + kitchenFrontThickness({ ...otherState, fin: otherState.fin ?? 'White' });
        }
      }
      return 0;
    }
  }
  const hasA = Boolean(box.state.endPanelSides?.includes(side)), hasB = Boolean(other?.state.endPanelSides?.includes(side === 1 ? -1 : 1));
  const wA = hasA ? endPanelThickness(box.state) : 0, wB = hasB && other ? endPanelThickness(other.state) : 0;
  const cfgA = hasA && wA > 0 && box.state.endPanelThickness !== undefined;
  const cfgB = hasB && wB > 0 && other?.state.endPanelThickness !== undefined;
  return cfgA !== cfgB ? (cfgA ? wA : wB) : Math.max(wA, wB);
}
