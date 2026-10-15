import type { createShapeInspector } from '../editor/shape-inspector';
type Inspector = ReturnType<typeof createShapeInspector>;
interface Ports {
    document: Pick<Document, 'createElement'>;
    shapeInspector: Pick<Inspector, 'beginHandleDrag' | 'moveHandleDrag' | 'endHandleDrag' | 'setFocusedPoint' | 'nudge' | 'split'>;
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
            button.onclick = e => { e.stopPropagation(); shapeInspector.split(Number(button.dataset.index)); };
            splitPool[n] = button;
        }
        return el;
    }
    return { shapeHandle, splitHandle, shapeHandlePool, splitPool };
}
