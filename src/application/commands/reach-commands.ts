import type { EditorScene } from '../projects/editor-scene';
import { applyMaxReach, clampReach } from '../../domain/wardrobe/max-reach';

interface Ports { checkpoint(): void; report(message: string): void }

/** The project's max reach: one height for every wardrobe and cabinet in it. Setting it is one undo step; clearing it
 * (null) puts every design back to the usual height and hides the reach line and its figures. */
export function createReachCommands(getScene: () => EditorScene, { checkpoint }: Ports) {
  return {
    /** `recordHistory` false is for live previews (a figure being dragged), whose caller owns the one undo step. */
    setMaxReach(value: number | null, recordHistory = true): boolean {
      const scene = getScene(), next = value === null ? undefined : Number.isFinite(value) ? clampReach(value) : scene.maxReach;
      if (next === scene.maxReach) return false;
      if (recordHistory) checkpoint();
      if (next === undefined) delete scene.maxReach; else scene.maxReach = next;
      for (const cabinet of scene.wardrobes) applyMaxReach(cabinet.state, scene.maxReach);
      return true;
    },
  };
}
