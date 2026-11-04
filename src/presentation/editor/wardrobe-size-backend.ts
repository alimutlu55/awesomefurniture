import type { createEditorModel } from '../../application/projects/editor-model';
import type { createSceneCommands } from '../../application/commands/scene-commands';
import { resolveShape, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { constrainWardrobeDrawing } from '../../domain/wardrobe/shape/size-drawing-constraints';
import { withRear } from '../../domain/wardrobe/shape/depth-shape';
import { wardrobeDrawingProfile, wardrobeDrawingRoof } from '../../domain/wardrobe/shape/size-drawing-profile';
import type { ShapeEditorBackend } from './shape-editor-backend';
import { shapeFields } from './surface-shape-fields';

export interface WardrobeSizeBackendPorts {
  model: Pick<ReturnType<typeof createEditorModel>, 'activeCabinet' | 'scene' | 'snapshot' | 'restore'>;
  sceneCommands: Pick<ReturnType<typeof createSceneCommands>, 'setShape' | 'shapeEditProblem' | 'growFrontShape' | 'setCabinetSize' | 'previewTranslation'>;
  history: { checkpoint(snapshot: string): void };
  rebuild(): void;
  report(message: string): void;
}

/** Adapts the existing wardrobe model and validated commands to the same drawing used by studio surfaces. */
export function createWardrobeSizeBackend({ model, sceneCommands, history, rebuild, report }: WardrobeSizeBackendPorts): ShapeEditorBackend {
  let problem: string | null = null;
  const atomic = (record: boolean, edit: () => boolean) => {
    const before = model.snapshot();
    if (!edit()) { model.restore(before); return false; }
    if (record && model.snapshot() !== before) history.checkpoint(before);
    return true;
  };
  const backend: ShapeEditorBackend = {
    restorePreview: true,
    autoFocusNarrow: false,
    project: (profile, points) => constrainWardrobeDrawing(profile.points, points),
    problem: () => problem,
    read: (ref, view) => model.scene.wardrobes.length && ref.id === 'wardrobe:' + model.activeCabinet().id
      ? wardrobeDrawingProfile(model.activeCabinet(), view) : null,
    primary: () => 'front',
    neighbours: () => model.scene.wardrobes.filter(c => c.id !== model.activeCabinet().id).map(c => ({ x: 0, y: (c.y || 0) + c.state.h })),
    fields(s, points, pick) {
      const fields = shapeFields(s, points, pick).filter(f => pick || f.key !== 'left')
        .map(f => !pick && f.key === 'width' ? { ...f, label: s.view === 'front' ? 'Width' : 'Depth' } : f);
      if (!pick) {
        if (s.view === 'front') fields.splice(2, 0, { key: 'depth', label: 'Depth', value: model.activeCabinet().state.d });
      }
      return fields;
    },
    field(key, value) {
      if (key === 'depth' || (key === 'width' && resolveShape(model.activeCabinet().state).top.length === 2)) {
        const axis = key === 'width' ? 'w' : 'd';
        return atomic(true, () => {
          const c = model.activeCabinet();
          if (Math.abs(c.state[axis] - value) < .001) return true;
          return sceneCommands.setCabinetSize(axis, value, false) && Math.abs(c.state[axis] - value) < .001;
        });
      }
      return undefined;
    },
    write(ref, points, view = 'front', record = true, quiet = false) {
      problem = null;
      if (ref.id !== 'wardrobe:' + model.activeCabinet().id) return false;
      const roof = wardrobeDrawingRoof(points);
      if (!roof || (view === 'side' && roof.top.length !== 2)) {
        problem = 'Keep the wardrobe base level and its sides upright. Edit the top edge to add corners or steps.';
        if (!quiet) report(problem);
        return false;
      }
      return atomic(record, () => {
        const c = model.activeCabinet(), original = resolveShape(c.state), angle = c.angle * Math.PI / 180;
        const base = c.y || 0;
        if (Math.abs(base - roof.floor) > .001) {
          sceneCommands.previewTranslation(c.id, { x: c.x, y: roof.floor, z: c.z });
          if (Math.abs((c.y || 0) - roof.floor) > .001) { problem = 'That floor height does not fit here.'; return false; }
        }
        let shape: WardrobeShape;
        if (view === 'side') {
          if (Math.abs(roof.width - c.state.d) > .001 && !sceneCommands.setCabinetSize('d', roof.width, false)) {
            problem = 'That depth does not fit in the available space.'; return false;
          }
          if (Math.abs(c.state.d - roof.width) > .001) { problem = 'Keep the depth within the wardrobe size limits.'; return false; }
          const front = Math.max(...original.top.map(p => p.y)), rear = Math.max(...(original.back ?? original.top.map(p => p.y)));
          shape = { template: 'custom', top: original.top.map(p => ({ ...p, y: p.y + roof.top[1]!.y - front })),
            back: original.top.map((p, i) => (original.back?.[i] ?? p.y) + roof.top[0]!.y - rear) };
        } else {
          const scaled = { ...original, top: original.top.map(p => ({ ...p, x: p.x * roof.width / c.state.w })) };
          shape = { ...withRear(scaled, roof.top), template: 'custom' };
          const offset = roof.left + (roof.width - c.state.w) / 2;
          const frame = { w: roof.width, x: c.x + offset * Math.cos(angle), z: c.z - offset * Math.sin(angle) };
          shape = sceneCommands.growFrontShape(shape, scaled, frame);
          if (JSON.stringify(shape) === JSON.stringify(c.state.shape) && Math.abs(offset) < .001 && roof.width === c.state.w) return true;
          problem = sceneCommands.shapeEditProblem(shape, frame);
          return !problem && sceneCommands.setShape(shape, false, !quiet, frame);
        }
        if (JSON.stringify(shape) === JSON.stringify(c.state.shape)) return true;
        problem = sceneCommands.shapeEditProblem(shape);
        return !problem && sceneCommands.setShape(shape, false, !quiet);
      });
    },
    preview: rebuild,
    settle() {},
  };
  return backend;
}
