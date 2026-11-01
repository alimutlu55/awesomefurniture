import { type Construction, constructionOf, DEFAULT_CONSTRUCTION } from '../../domain/make/make-construction';
import type { EditorScene } from '../projects/editor-scene';

/**
 * Make's one change to a design: how a piece is put together (its joint system and how its back is held). It changes
 * no size and no board, only what is drilled and bought, and it is one undo step. The defaults are not written down.
 */
export function createMakeCommands(getScene: () => EditorScene, checkpoint: () => void) {
  return {
    setConstruction(id: number, change: Partial<Construction>): boolean {
      const cabinet = getScene().wardrobes.find(c => c.id === id);
      if (!cabinet) return false;
      const now = constructionOf(cabinet.state), next = constructionOf({ construction: { ...now, ...change } });
      if (next.joints === now.joints && next.back === now.back) return false;
      checkpoint();
      if (next.joints === DEFAULT_CONSTRUCTION.joints && next.back === DEFAULT_CONSTRUCTION.back) delete cabinet.state.construction;
      else cabinet.state.construction = next;
      return true;
    },
  };
}
