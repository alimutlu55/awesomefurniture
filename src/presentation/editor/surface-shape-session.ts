import { healProfile, type ProfileVertex } from '../../domain/geometry/profile-polygon';
import { type SurfaceRef, type SurfaceView } from '../../domain/studio/surface-profile';
import { createSurfaceShapeBackend } from './shape-editor-backend';
import type { SurfaceShapeEditorPorts } from './surface-shape-editor.ports';

/** One drag of a shape: the room before it, live previews that reshape the wardrobes under it, and the end,
 * which heals the outline and takes one undo step, or a cancel that puts everything back. */
type SessionPorts = Pick<SurfaceShapeEditorPorts, 'model' | 'sceneCommands' | 'history' | 'callbacks' | 'backend'>;
export function createShapeSession({ model, sceneCommands, history, callbacks, backend = createSurfaceShapeBackend({ model, sceneCommands, callbacks }) }: SessionPorts) {
  let active: { ref: SurfaceRef; view: SurfaceView | undefined; snapshot: string; last: ProfileVertex[] } | null = null;
  return {
    /** `view`: which side is being shaped (its main outline when left out). */
    begin(ref: SurfaceRef, view?: SurfaceView) {
      const s = backend.read(ref, view);
      if (!s) return false;
      active = { ref, view, snapshot: model.snapshot(), last: s.points };
      return true;
    },
    /** Shows `points` in the room, quietly. False when the room refuses them (the last preview stays). */
    preview(points: readonly ProfileVertex[]) {
      if (!active) return false;
      const { ref, view } = active;
      const previous = backend.restorePreview ? model.snapshot() : null;
      if (backend.restorePreview) model.restore(active.snapshot);
      if (!backend.write(ref, points, view, false, true)) {
        if (previous) model.restore(previous);
        return false;
      }
      active.last = [...points];
      backend.preview();
      return true;
    },
    /** Ends the drag: the last preview, healed, as one undo step when anything changed. Returns the healed outline. */
    end(): ProfileVertex[] | null {
      const g = active;
      if (!g) return null;
      active = null;
      const healed = healProfile(g.last);
      if (backend.restorePreview) model.restore(g.snapshot);
      backend.write(g.ref, healed, g.view, false, false);
      if (model.snapshot() !== g.snapshot) history.checkpoint(g.snapshot);
      backend.settle();
      callbacks.refresh();
      return healed;
    },
    cancel() {
      const g = active;
      if (!g) return;
      active = null;
      model.restore(g.snapshot);
      callbacks.refresh();
    },
    /** Forgets a drag that never moved: nothing to put back. */
    drop() { active = null; },
    active: () => active !== null,
    last: () => active?.last ?? null,
  };
}
