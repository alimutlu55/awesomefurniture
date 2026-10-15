import { createTactileFeedback } from './tactile-feedback';
import type { MountEditorBindingsPorts } from './mount-editor-bindings.ports';
import type { createTactileEdits, ScrubDimension } from '../../application/commands/tactile-edits';

type Ports = Pick<MountEditorBindingsPorts, 'dom' | 'model' | 'lifetime' | 'inspector' | 'selectionState' | 'camera'>
    & { edits: ReturnType<typeof createTactileEdits> };
/** Capture on the stable label layer: the badge can be redrawn every frame
 * without losing the finger, even when it reaches the cabinet's physical limit. */
export function bindDimensionScrubbers({ dom, lifetime, inspector, selectionState, camera, edits }: Ports) {
    const labels = dom.$('#labels'), app = dom.$('#app'), feedback = createTactileFeedback(dom);
    let drag: { pointer: number; key: ScrubDimension; x: number; y: number; delta: number; applied: number; moved: boolean } | null = null;
    let queued = false;
    const selector = (key: ScrubDimension) => `[data-scrub-dimension="${key}"]`;
    const flush = () => {
        if (!drag || drag.applied === drag.delta) return;
        drag.applied = drag.delta;
        const value = edits.previewDimension(drag.delta);
        if (value !== null) feedback.tick(value);
        inspector.update(true);
    };
    function finish(cancel = false) {
        const g = drag;
        if (!g) return;
        if (!cancel) flush();
        drag = null;
        const changed = edits.finish(cancel);
        delete app.dataset.scrubbing;
        if (labels.hasPointerCapture(g.pointer)) labels.releasePointerCapture(g.pointer);
        inspector.update(true);
        if (changed) feedback.settle(labels.querySelector(selector(g.key)));
    }
    lifetime.listen(labels, 'pointerdown', (raw: Event) => {
        const e = raw as PointerEvent, target = (e.target as HTMLElement).closest<HTMLElement>('[data-scrub-dimension]');
        if (!target || e.button !== 0 || selectionState.shapeEditing || selectionState.viewMode !== 'wardrobe' || edits.active()) return;
        e.preventDefault(); e.stopPropagation(); camera.camRelease();
        const key = target.dataset.scrubDimension as ScrubDimension;
        edits.beginDimension(key); feedback.begin(edits.value(key)); app.dataset.scrubbing = key;
        drag = { pointer: e.pointerId, key, x: e.clientX, y: e.clientY, delta: 0, applied: 0, moved: false };
        labels.setPointerCapture(e.pointerId);
    });
    lifetime.listen(labels, 'pointermove', (raw: Event) => {
        const e = raw as PointerEvent;
        if (!drag || e.pointerId !== drag.pointer) return;
        e.preventDefault(); e.stopPropagation();
        const pixels = drag.key.startsWith('h') ? drag.y - e.clientY : e.clientX - drag.x;
        if (!drag.moved && Math.abs(pixels) < 5) return;
        drag.moved = true; drag.delta = Math.round(pixels * (e.shiftKey ? .1 : .35));
        if (!queued) { queued = true; lifetime.frame(() => { queued = false; flush(); }); }
    });
    lifetime.listen(labels, 'pointerup', (raw: Event) => { const e = raw as PointerEvent; if (drag?.pointer === e.pointerId) { e.stopPropagation(); finish(); } });
    lifetime.listen(labels, 'pointercancel', () => finish(true));
    lifetime.listen(labels, 'lostpointercapture', () => finish(true));
    lifetime.listen(app, 'pointerdown', (raw: Event) => {
        const e = raw as PointerEvent;
        if (drag && e.pointerId !== drag.pointer) { finish(true); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    lifetime.listen(dom.window, 'blur', () => finish(true));
    lifetime.listen(dom.document, 'keydown', (raw: Event) => {
        const e = raw as KeyboardEvent;
        if (drag && (e.key === 'Escape' || e.metaKey || e.ctrlKey)) { finish(true); if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); } }
    }, true);
    lifetime.listen(labels, 'keydown', (raw: Event) => {
        const e = raw as KeyboardEvent, el = e.target as HTMLElement, key = el.dataset.scrubDimension as ScrubDimension | undefined;
        if (!key || edits.active() || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        const delta = e.key === 'Home' ? Number(el.getAttribute('aria-valuemin')) - edits.value(key)
            : e.key === 'End' ? Number(el.getAttribute('aria-valuemax')) - edits.value(key)
                : (e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1);
        edits.beginDimension(key); feedback.begin(edits.value(key)); const value = edits.previewDimension(delta); const changed = edits.finish();
        inspector.update(true); const next = labels.querySelector<HTMLElement>(selector(key)); next?.focus({ preventScroll: true });
        if (changed) { if (value !== null) feedback.tick(value); feedback.settle(next); }
    });
    lifetime.cleanup(() => finish(true));
}
