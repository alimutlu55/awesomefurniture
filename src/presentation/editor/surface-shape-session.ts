import { healProfile, type ProfileVertex } from '../../domain/geometry/profile-polygon';
import { surfaceProfile, withSurfaceProfile, type SurfaceRef } from '../../domain/studio/surface-profile';
import type { SurfaceShapeEditorPorts } from './surface-shape-editor.ports';

/** One drag of a shape: the room before it, live previews that reshape the wardrobes under it, and the end,
 * which heals the outline and takes one undo step, or a cancel that puts everything back. */
export function createShapeSession({ model, sceneCommands, history, callbacks }: Pick<SurfaceShapeEditorPorts, 'model' | 'sceneCommands' | 'history' | 'callbacks'>) {
  let active: { ref: SurfaceRef; snapshot: string; last: ProfileVertex[] } | null = null;
  const studioOf = (snapshot: string) => JSON.stringify(JSON.parse(snapshot).studio ?? null);
  return {
    begin(ref: SurfaceRef) {
      const room = model.scene.studio, s = room && surfaceProfile(room, ref);
      if (!s) return false;
      active = { ref, snapshot: model.snapshot(), last: s.points };
      return true;
    },
    /** Shows `points` in the room, quietly. False when the room refuses them (the last preview stays). */
    preview(points: readonly ProfileVertex[]) {
      if (!active) return false;
      const { ref } = active;
      if (!sceneCommands.editStudio(r => withSurfaceProfile(r, ref, points), false, true)) return false;
      active.last = [...points];
      if (sceneCommands.followCeilings(false)) callbacks.rebuild(); else callbacks.redraw();
      return true;
    },
    /** Ends the drag: the last preview, healed, as one undo step when anything changed. Returns the healed outline. */
    end(): ProfileVertex[] | null {
      const g = active;
      if (!g) return null;
      active = null;
      const healed = healProfile(g.last);
      sceneCommands.editStudio(r => withSurfaceProfile(r, g.ref, healed), false, true);
      if (JSON.stringify(model.scene.studio ?? null) !== studioOf(g.snapshot)) history.checkpoint(g.snapshot);
      sceneCommands.followCeilings(true);
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
