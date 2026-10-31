import type { createEditorModel } from '../../application/projects/editor-model';
import type { createSceneCommands } from '../../application/commands/scene-commands';
import { resolveShape, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { withRear } from '../../domain/wardrobe/shape/depth-shape';
import { wardrobeDrawingProfile, wardrobeDrawingRoof } from '../../domain/wardrobe/shape/size-drawing-profile';
import type { ShapeEditorBackend } from './shape-editor-backend';
import { shapeFields } from './surface-shape-fields';

export interface WardrobeSizeBackendPorts {
  model: Pick<ReturnType<typeof createEditorModel>, 'activeCabinet' | 'scene' | 'snapshot' | 'restore'>;
  sceneCommands: Pick<ReturnType<typeof createSceneCommands>, 'setShape' | 'growFrontShape' | 'setCabinetSize' | 'previewTranslation'>;
  history: { checkpoint(snapshot: string): void };
  rebuild(): void;
  report(message: string): void;
}

/** Adapts the existing wardrobe model and validated commands to the same drawing used by studio surfaces. */
export function createWardrobeSizeBackend({ model, sceneCommands, history, rebuild, report }: WardrobeSizeBackendPorts): ShapeEditorBackend {
  const atomic = (record: boolean, edit: () => boolean) => {
    const before = model.snapshot();
    if (!edit()) { model.restore(before); return false; }
    if (record && model.snapshot() !== before) history.checkpoint(before);
    return true;
  };
  const backend: ShapeEditorBackend = {
    restorePreview: true,
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
      if (key !== 'depth') return undefined;
      return atomic(true, () => {
        const c = model.activeCabinet();
        if (Math.abs(c.state.d - value) < .001) return true;
        return sceneCommands.setCabinetSize('d', value, false) && Math.abs(c.state.d - value) < .001;
      });
    },
    write(ref, points, view = 'front', record = true, quiet = false) {
      if (ref.id !== 'wardrobe:' + model.activeCabinet().id) return false;
      const roof = wardrobeDrawingRoof(points);
      if (!roof || (view === 'side' && roof.top.length !== 2)) {
        if (!quiet) report('Keep the wardrobe base level and its sides upright. Edit the top edge to add corners or steps.');
        return false;
      }
      return atomic(record, () => {
        const c = model.activeCabinet(), original = resolveShape(c.state), angle = c.angle * Math.PI / 180;
        const base = c.y || 0;
        if (Math.abs(base - roof.floor) > .001) {
          sceneCommands.previewTranslation(c.id, { x: c.x, y: roof.floor, z: c.z });
          if (Math.abs((c.y || 0) - roof.floor) > .001) return false;
        }
        let shape: WardrobeShape;
        if (view === 'side') {
          if (Math.abs(roof.width - c.state.d) > .001 && !sceneCommands.setCabinetSize('d', roof.width, false)) return false;
          if (Math.abs(c.state.d - roof.width) > .001) return false;
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
          return sceneCommands.setShape(shape, false, !quiet, frame);
        }
        if (JSON.stringify(shape) === JSON.stringify(c.state.shape)) return true;
        return sceneCommands.setShape(shape, false, !quiet);
      });
    },
    preview: rebuild,
    settle() {},
  };
  return backend;
}
