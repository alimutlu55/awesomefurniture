import { bindMeasurementBadges } from '../components/measurement-badge';
import { createTactileFeedback } from './tactile-feedback';
import { createMeasurementPreview } from '../../application/commands/measurement-preview';
import type { SceneMeasurement } from '../../application/commands/scene-measurements';
import type { MountEditorBindingsPorts } from './mount-editor-bindings.ports';
import type { createTactileEdits, ScrubDimension } from '../../application/commands/tactile-edits';

type Ports = Pick<MountEditorBindingsPorts, 'dom' | 'model' | 'lifetime' | 'inspector' | 'selectionState' | 'camera' | 'history' | 'room' | 'interactionState'>
    & { edits: ReturnType<typeof createTactileEdits> };
/** The editor adapter supplies values and validation to one shared component. */
export function bindDimensionScrubbers({ dom, model, lifetime, inspector, selectionState, camera, edits, history, room, interactionState }: Ports) {
    const scene = createMeasurementPreview({ model, checkpoint: history.checkpoint });
    const active = () => edits.active() || scene.active();
    bindMeasurementBadges({ layer: dom.$('#labels'), boundary: dom.$('#app'), windowEvents: dom.window,
        lifetime, feedback: createTactileFeedback(dom), busy: () => active() || !!(interactionState.drag || interactionState.moveMode
            || interactionState.itemEdgeGesture || interactionState.dividerGesture || interactionState.wardrobeGesture || interactionState.rotationGesture),
        active: id => { if (id === null) delete dom.$('#app').dataset.scrubbing; else { camera.camRelease(); dom.$('#app').dataset.scrubbing = id; } },
        resolve: el => {
            if (!el.dataset.measurementBadge || room.editor.dragging()) return null;
            const id = el.dataset.measurementBadge, selector = '[data-measurement-badge="' + id + '"]';
            const orientation = el.getAttribute('aria-orientation') === 'vertical' ? 'vertical' as const : 'horizontal' as const;
            const min = Number(el.getAttribute('aria-valuemin') ?? 0), max = Number(el.getAttribute('aria-valuemax') ?? 2000);
            const refresh = () => { inspector.update(true); room.fields.render(); };
            const key = el.dataset.scrubDimension as ScrubDimension | undefined;
            if (key) {
                if (selectionState.shapeEditing || selectionState.viewMode !== 'wardrobe') return null;
                return { id, selector, orientation, min, max, entry: true, read: () => edits.value(key),
                    begin: () => edits.beginDimension(key), preview: delta => edits.previewDimension(delta), finish: cancel => edits.finish(cancel), refresh };
            }
            if (!el.dataset.sceneMeasurement) return null;
            const ref = JSON.parse(decodeURIComponent(el.dataset.sceneMeasurement)) as SceneMeasurement;
            if (scene.read(ref) === null) return null;
            return { id, selector, orientation, min, max, entry: true, read: () => scene.read(ref) ?? 0,
                begin: () => scene.begin(ref), preview: delta => scene.preview(delta), finish: cancel => scene.finish(cancel), refresh };
        },
    });
    return { active: scene.active };
}
