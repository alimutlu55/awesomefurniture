import type { EditorDesign } from '../wardrobe/editor-design';
import { cornerReturnJoints, cornerStripWidth } from './corner-widths';
import { panelAtSide, type PanelPose } from './end-panels';
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
          const joint = cornerReturnJoints(box, [other]).find(j => j.side === side && j.blind);
          if (joint) return joint.requiredGap;
          const otherState = other.state as PanelPose['state'] & Partial<Pick<EditorDesign, 'frontThickness' | 'fin' | 'materials'>>;
          return cornerStripWidth(box.state) + kitchenFrontThickness({ ...otherState, fin: otherState.fin ?? 'White' });
        }
      }
      return 0;
    }
  }
  const pA = panelAtSide(box.state, side), pB = other ? panelAtSide(other.state, side === 1 ? -1 : 1) : { width: 0, configured: false };
  return pA.configured !== pB.configured ? (pA.configured ? pA.width : pB.width) : Math.max(pA.width, pB.width);
}
