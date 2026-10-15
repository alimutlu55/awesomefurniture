import type { createShapeInspector } from '../editor/shape-inspector';
type Inspector = ReturnType<typeof createShapeInspector>;
interface Ports {
    document: Pick<Document, 'createElement'>;
    shapeInspector: Pick<Inspector, 'beginHandleDrag' | 'moveHandleDrag' | 'endHandleDrag' | 'setFocusedPoint' | 'nudge'
        | 'moveSplitCursor' | 'splitPosition' | 'restoreSplitCursor' | 'nudgeSplitCursor' | 'insertSplitPoint'>;
}
/** Retain the captured DOM node across geometry rebuilds. */
export function createShapeHandleButtons({ document, shapeInspector }: Ports) {
    const shapeHandlePool: HTMLButtonElement[] = [], splitPool: HTMLButtonElement[] = [];
    const side = (el: HTMLElement) => el.dataset.side === 'rear' ? 'rear' : 'front';
    function shapeHandle(n: number) {
        let el = shapeHandlePool[n];
        if (!el) {
            el = document.createElement('button');
            el.type = 'button'; el.className = 'lbl shape-handle point';
            const button = el;
            button.onpointerdown = e => {
                // Expanded touch targets overlap when the top edges project close
                // together. The nearest dot owns the gesture, regardless of DOM order.
                let nearest = button, distance = Infinity;
                for (const candidate of shapeHandlePool) {
                    if (!candidate.isConnected) continue;
                    const r = candidate.getBoundingClientRect();
                    if (!r.width || !r.height) continue;
                    const d = Math.hypot(e.clientX - r.x - r.width / 2, e.clientY - r.y - r.height / 2);
                    if (d < distance) { nearest = candidate; distance = d; }
                }
                shapeInspector.beginHandleDrag(e, Number(nearest.dataset.index), nearest, side(nearest));
            };
            button.onpointermove = e => shapeInspector.moveHandleDrag(e);
            button.onpointerup = () => shapeInspector.endHandleDrag();
            button.onpointercancel = () => shapeInspector.endHandleDrag(true);
            button.onlostpointercapture = () => shapeInspector.endHandleDrag();
            button.onfocus = () => shapeInspector.setFocusedPoint(Number(button.dataset.index), side(button));
            button.onblur = () => shapeInspector.setFocusedPoint(null);
            button.onkeydown = e => {
                const step = e.shiftKey ? .5 : 1;
                const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
                const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
                if (dx || dy) {
                    e.preventDefault();
                    shapeInspector.nudge(Number(button.dataset.index), dx, dy, side(button));
                }
            };
            shapeHandlePool[n] = button;
        }
        return el;
    }
    function splitHandle(n: number) {
        let el = splitPool[n];
        if (!el) {
            el = document.createElement('button');
            el.type = 'button'; el.className = 'lbl shape-handle split-handle'; el.textContent = '+';
            const button = el;
            let gesture: { pointer: number; x: number; y: number; moved: boolean; before: number | undefined } | null = null;
            button.onpointerdown = e => {
                e.preventDefault(); e.stopPropagation();
                gesture = { pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, before: shapeInspector.splitPosition(side(button)) };
                button.setPointerCapture(e.pointerId);
            };
            button.onpointermove = e => {
                if (!gesture || gesture.pointer !== e.pointerId) return;
                if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < 5 && !gesture.moved) return;
                gesture.moved = true; shapeInspector.moveSplitCursor(e, side(button));
            };
            const end = (cancel: boolean) => {
                const g = gesture; gesture = null;
                if (!g) return;
                if (button.hasPointerCapture(g.pointer)) button.releasePointerCapture(g.pointer);
                if (cancel) shapeInspector.restoreSplitCursor(side(button), g.before);
                else if (!g.moved) shapeInspector.insertSplitPoint(side(button));
            };
            button.onpointerup = () => end(false);
            button.onpointercancel = () => end(true);
            button.onlostpointercapture = () => end(true);
            button.onclick = e => { e.stopPropagation(); if (e.detail === 0) shapeInspector.insertSplitPoint(side(button)); };
            button.onkeydown = e => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault(); shapeInspector.nudgeSplitCursor(side(button), (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? .5 : 1));
                }
            };
            splitPool[n] = button;
        }
        return el;
    }
    return { shapeHandle, splitHandle, shapeHandlePool, splitPool };
}
