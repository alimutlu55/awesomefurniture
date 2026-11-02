import type { ProfileVertex, Vec } from '../../domain/geometry/profile-polygon';
import { primaryView, surfaceProfile, withSurfaceProfile, setSurfaceDepth, type SurfaceProfile, type SurfaceRef, type SurfaceView } from '../../domain/studio/surface-profile';
import { setWallSize } from '../../domain/studio/studio-edit';
import { outerEdgeHeight, setOuterEdgeHeight } from '../../domain/studio/ceiling-edge';
import { STUDIO_LIMITS } from '../../domain/studio/studio';
import { neighbourPoints } from './studio-align';
import { shapeFields, type ShapeField } from './surface-shape-fields';
import type { ShapePick } from './surface-shape-drawing';
import type { SurfaceShapeEditorPorts } from './surface-shape-editor.ports';
import { adjoiningWallReferences } from './adjoining-wall-references';
import { autoAlignWallProfile } from './surface-shape-auto-align';

/** Geometry and commands behind the shared Size drawing. The pointer, zoom and field UI have one owner. */
export interface ShapeEditorBackend {
  readonly restorePreview?: boolean;
  readonly autoFocusNarrow?: boolean;
  project?(profile: SurfaceProfile, points: readonly ProfileVertex[]): ProfileVertex[];
  problem?(): string | null;
  read(ref: SurfaceRef, view?: SurfaceView): SurfaceProfile | null;
  write(ref: SurfaceRef, points: readonly ProfileVertex[], view: SurfaceView | undefined, record?: boolean, quiet?: boolean): boolean;
  primary(ref: SurfaceRef): SurfaceView;
  neighbours(profile: SurfaceProfile): readonly Vec[];
  fields(profile: SurfaceProfile, points: readonly ProfileVertex[], pick: ShapePick): ShapeField[];
  field(key: string, value: number, profile: SurfaceProfile, pick: ShapePick): boolean | undefined;
  preview(): void;
  settle(): void;
  reset?(profile: SurfaceProfile): ProfileVertex[] | null;
  resetLabel?(profile: SurfaceProfile): string;
  autoAlign?(profile: SurfaceProfile): ProfileVertex[] | null;
}

export function createSurfaceShapeBackend({ model, sceneCommands, callbacks }: Pick<SurfaceShapeEditorPorts, 'model' | 'sceneCommands' | 'callbacks'>): ShapeEditorBackend {
  return {
    read: (ref, view) => {
      const room = model.scene.studio, s = room && surfaceProfile(room, ref, view);
      return room && s ? { ...s, adjoining: adjoiningWallReferences(room, s) } : null;
    },
    write: (ref, points, view, record = true, quiet = false) => sceneCommands.editStudio(r => withSurfaceProfile(r, ref, points, view), record, quiet),
    primary: ref => model.scene.studio ? primaryView(model.scene.studio, ref) : 'front',
    neighbours: s => model.scene.studio ? neighbourPoints(model.scene.studio, s, model.scene.wardrobes.map(f =>
      ({ x: f.x, z: f.z, angle: f.angle, w: f.state.w, d: f.state.d, h: f.state.h }))) : [],
    fields(s, points, pick) {
      const c = s.ref.kind === 'ceiling' ? model.scene.studio?.ceilings?.find(x => x.id === s.ref.id) : undefined;
      const outer = c && c.run === 'along' && s.primary && !c.section && Math.min(...points.map(p => p.y)) >= STUDIO_LIMITS.minCeilingHeight ? outerEdgeHeight(c) : undefined;
      const fields = shapeFields(s, points, pick, outer);
      if (!pick && s.ref.kind === 'wall' && s.view === 'front') fields.push({ key: 'thickness', label: 'Thickness', value: s.depth });
      return fields;
    },
    field(key, value, s) {
      if (key === 'thickness') return sceneCommands.editStudio(r => setWallSize(r, s.ref.id, { thickness: value }));
      if (key !== 'depth' && key !== 'outer') return undefined;
      return sceneCommands.editStudio(r => key === 'depth' ? setSurfaceDepth(r, s.ref, value) : setOuterEdgeHeight(r, s.ref.id, value));
    },
    preview() { if (sceneCommands.followCeilings(false)) callbacks.rebuild(); else callbacks.redraw(); },
    settle() { sceneCommands.followCeilings(true); },
    reset: s => s.ref.kind === 'wall' ? [
      { x: s.bounds.minX, y: 0 }, { x: s.bounds.maxX, y: 0 }, { x: s.bounds.maxX, y: s.wall.height }, { x: s.bounds.minX, y: s.wall.height },
    ] : null,
    resetLabel: s => s.primary ? 'Full wall' : 'Plain side',
    autoAlign: s => s.ref.kind === 'wall' ? autoAlignWallProfile(s) : null,
  };
}
