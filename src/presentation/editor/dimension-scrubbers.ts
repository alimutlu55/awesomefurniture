import { bindMeasurementBadges } from '../components/measurement-badge';
import { createTactileFeedback } from './tactile-feedback';
import { createMeasurementPreview } from '../../application/commands/measurement-preview';
import type { SceneMeasurement } from '../../application/commands/scene-measurements';
import type { MountEditorBindingsPorts } from './mount-editor-bindings.ports';
import type { createTactileEdits, ScrubDimension } from '../../application/commands/tactile-edits';

type Ports = Pick<MountEditorBindingsPorts, 'dom' | 'model' | 'lifetime' | 'inspector' | 'selectionState' | 'camera' | 'history' | 'room' | 'interactionState'>
    & { edits: ReturnType<typeof createTactileEdits> };
/** The size fields a furniture reading opens on. */
const SIZE_FIELDS = { w: '#w', h: '#h', d: '#d' } as const;
/** The editor adapter supplies values and validation to one shared component. */
/** `openSize` opens the selected furniture's Size sheet. */
export function bindDimensionScrubbers({ dom, model, lifetime, inspector, selectionState, camera, edits, history, room, interactionState, openSize }: Ports & { openSize: () => void }) {
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
                if (selectionState.shapeEditing || selectionState.viewMode !== 'furniture') return null;
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
    // In Furniture, a reading lets touches through to the furniture until Size is open (furniture.css). A tap on
    // the furniture's width, height or depth opens Size on that field, ready to type. The reading is found when the
    // finger lands: by the click, the tap may have reached the floor under it and cleared the selection.
    let pressed: { key: string; id: number; x: number; y: number } | null = null;
    lifetime.listen(dom.$('#c'), 'pointerdown', (raw: Event) => {
        const e = raw as PointerEvent, app = dom.$('#app');
        pressed = null;
        if (selectionState.viewMode !== 'furniture' || (app.classList.contains('props-open') && dom.$('#left').dataset.contextSection === 'resize')) return;
        const hit = [...dom.$('#labels').querySelectorAll<HTMLElement>('[data-scrub-dimension]')].find(b => {
            const r = b.getBoundingClientRect();
            return r.width > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        });
        if (hit?.dataset.scrubDimension) pressed = { key: hit.dataset.scrubDimension, id: model.scene.activeWardrobe, x: e.clientX, y: e.clientY };
    }, true);
    lifetime.listen(dom.$('#c'), 'click', (raw: Event) => {
        const e = raw as MouseEvent, tap = pressed;
        pressed = null;
        if (!tap || Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) return;
        if (!selectionState.focusOn || model.scene.activeWardrobe !== tap.id) inspector.selectCabinet(tap.id);
        // The reading measures the whole piece (Size leaves a space chosen inside), not an item the tap may have chosen.
        Object.assign(model.activeCabinet().state, { item: -1, divider: -1 });
        openSize();
        const field = tap.key in SIZE_FIELDS ? dom.$(SIZE_FIELDS[tap.key as keyof typeof SIZE_FIELDS]) : null;
        field?.focus({ preventScroll: true }); field?.select();
    });
    return { active: scene.active };
}
