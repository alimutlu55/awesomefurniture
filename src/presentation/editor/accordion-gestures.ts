import { PANEL } from '../../domain/wardrobe/catalog';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry';
import type { Object3D } from 'three';
import { createTactileFeedback } from './tactile-feedback';
import type { MountEditorBindingsPorts } from './mount-editor-bindings.ports';
import type { createTactileEdits } from '../../application/commands/tactile-edits';

type Ports = Pick<MountEditorBindingsPorts, 'dom' | 'model' | 'lifetime' | 'picking' | 'renderState' | 'geometry'
    | 'selectionState' | 'interactionState' | 'interactions' | 'resources' | 'camera' | 'inspector' | 'room'>
    & { edits: ReturnType<typeof createTactileEdits> };
type Bay = { cabinet: number; section: number; x: number; y: number };
/** Two fingers starting in the same visible bay edit its shelf boards. All
 * other pinches retain the camera gesture. The remaining finger is drained
 * after release so finishing a shelf edit never becomes a camera jump or tap. */
export function bindAccordionGestures(ports: Ports) {
    const { dom, model, lifetime, picking, renderState, geometry, selectionState, interactionState,
        interactions, resources, camera, inspector, room, edits } = ports;
    const cv = resources.cv, app = dom.$('#app'), feedback = createTactileFeedback(dom);
    const pointers = new Map<number, { start: PointerEvent; current: PointerEvent; bay: Bay | null }>();
    let gesture: { span: number; requested: number } | null = null, draining = false, queued = false, suppressClickUntil = 0;
    const stop = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };
    function bayAt(e: PointerEvent): Bay | null {
        const control = (e.target as HTMLElement).closest('button,input,[role="slider"],.shape-handle,.mobile-bottom-sheet');
        if (control && !control.matches('.lbl.add')) return null;
        if (selectionState.viewMode !== 'wardrobe' || selectionState.shapeEditing || selectionState.editingSize
            || app.matches('.props-open,.auto-design-open,.adding') || room.surface.dragging() || !model.scene.wardrobes.length) return null;
        const hit = picking.cast(e, renderState.allHits), data = hit?.object.userData;
        const cabinet = model.scene.wardrobes.find(c => c.id === data?.wardrobe);
        if (!hit || !cabinet || typeof data?.i !== 'number') return null;
        const state = cabinet.state;
        if (state.doors !== 'none' && !state.open) return null;
        let group = hit.object;
        const groups: readonly Object3D[] = renderState.wardrobeGroups;
        while (group.parent && !groups.includes(group)) group = group.parent;
        if (!groups.includes(group) || group.worldToLocal(resources.cam.position.clone()).z < state.d / 2) return null;
        const p = group.worldToLocal(hit.point.clone());
        const widths = (cabinet.id === model.scene.activeWardrobe ? geometry : createWardrobeGeometry(() => state)).widths();
        const left = -state.w / 2 + PANEL + widths.slice(0, data.i).reduce((sum, w) => sum + w + PANEL, 0);
        const x = p.x - left;
        return x >= 0 && x <= widths[data.i]! ? { cabinet: cabinet.id, section: data.i, x, y: p.y } : null;
    }
    function flush() {
        if (!gesture || pointers.size !== 2) return;
        const [a, b] = [...pointers.values()];
        const span = Math.hypot(a!.current.clientX - b!.current.clientX, a!.current.clientY - b!.current.clientY);
        const count = Math.max(-8, Math.min(8, Math.trunc((span - gesture.span) / 36)));
        if (count === gesture.requested) return;
        gesture.requested = count;
        feedback.tick(edits.previewShelves(count)); inspector.update(true);
    }
    function finish(cancel = false) {
        if (!gesture) return;
        if (!cancel) flush();
        gesture = null; edits.finish(cancel); delete app.dataset.accordion; suppressClickUntil = performance.now() + 350;
        interactionState.moved = 99; inspector.update(true);
    }
    const reset = () => {
        finish(true); draining = false;
        const ids = [...pointers.keys()]; pointers.clear();
        for (const id of ids) if (cv.hasPointerCapture(id)) cv.releasePointerCapture(id);
    };
    lifetime.listen(app, 'pointerdown', (raw: Event) => {
        const e = raw as PointerEvent;
        if (e.pointerType !== 'touch') return;
        if (gesture || draining) {
            stop(e); pointers.set(e.pointerId, { start: e, current: e, bay: null });
            finish(true); draining = true; cv.setPointerCapture(e.pointerId); return;
        }
        if (edits.active()) return;
        const bay = bayAt(e); pointers.set(e.pointerId, { start: e, current: e, bay });
        if (pointers.size !== 2 || !bay) return;
        const [a, b] = [...pointers.values()];
        if (!a?.bay || !b?.bay || a.bay.cabinet !== b.bay.cabinet || a.bay.section !== b.bay.section || e.timeStamp - a.start.timeStamp > 450) return;
        if (model.scene.wardrobes.find(c => c.id === bay.cabinet)!.state.dividers.some(d => d.i === bay.section && d.orientation === 'vertical'
            && d.x! > Math.min(a.bay!.x, b.bay!.x) && d.x! < Math.max(a.bay!.x, b.bay!.x))) return;
        stop(e);
        if (interactionState.wardrobeGesture) interactions.finishWardrobeDrag(true);
        if (interactionState.dividerGesture) interactions.finishDividerDrag(true);
        interactions.cancelMovement(); interactionState.ptrs.clear(); interactionState.moved = 99; camera.camRelease();
        edits.beginShelves(bay.section, (a.bay.x + b.bay.x) / 2, (a.bay.y + b.bay.y) / 2, bay.cabinet);
        feedback.begin(0);
        gesture = { span: Math.hypot(a.current.clientX - b.current.clientX, a.current.clientY - b.current.clientY), requested: 0 };
        app.dataset.accordion = String(bay.section);
        for (const id of pointers.keys()) cv.setPointerCapture(id);
    }, true);
    lifetime.listen(app, 'pointermove', (raw: Event) => {
        const e = raw as PointerEvent, p = pointers.get(e.pointerId);
        if (p) {
            p.current = e;
            if (!gesture && Math.hypot(e.clientX - p.start.clientX, e.clientY - p.start.clientY) > 8) p.bay = null;
        }
        if (!gesture && !draining) return;
        stop(e);
        if (!queued) { queued = true; lifetime.frame(() => { queued = false; flush(); }); }
    }, true);
    const end = (raw: Event, cancel: boolean) => {
        const e = raw as PointerEvent;
        if (!gesture && !draining) { pointers.delete(e.pointerId); return; }
        stop(e); finish(cancel); pointers.delete(e.pointerId); draining = pointers.size > 0;
    };
    lifetime.listen(app, 'pointerup', (e: Event) => end(e, false), true);
    lifetime.listen(app, 'pointercancel', (e: Event) => end(e, true), true);
    lifetime.listen(app, 'click', (e: Event) => {
        if ((e.target as HTMLElement).closest('.lbl.add') && (draining || performance.now() < suppressClickUntil)) stop(e);
    }, true);
    lifetime.listen(app, 'lostpointercapture', (raw: Event) => {
        const e = raw as PointerEvent;
        if (gesture && pointers.has(e.pointerId)) { stop(e); reset(); }
    }, true);
    lifetime.listen(dom.document, 'keydown', (raw: Event) => {
        const e = raw as KeyboardEvent;
        if (gesture && (e.key === 'Escape' || e.metaKey || e.ctrlKey)) {
            reset(); if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); }
        }
    }, true);
    lifetime.listen(dom.window, 'blur', reset); lifetime.cleanup(reset);
}
