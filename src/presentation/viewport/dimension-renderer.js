import * as THREE from "three";
import { decorateDimensionScrubber } from './dimension-scrubber-label';
/** @param {Pick<import('./cabinet-renderer.ports').CreateCabinetRendererPorts, 'dom' | 'renderState' | 'resources'>} ports */
export function createDimensionRenderer({ dom, renderState, resources }) {
    const { $, document } = dom;
    function label(p, text, cls) {
        const el = document.createElement('div');
        el.className = cls;
        el.textContent = text;
        decorateDimensionScrubber(el, renderState.renderCabinet?.state);
        if (renderState.renderActive) {
            $('#labels').appendChild(el);
            renderState.labs.push({ p, el, owner: renderState.Gr });
        }
        return el;
    }
    function rulerScreenPlacement(a, b, axis, ew, eh, bounds) {
        // 'under': a width read below its line (a shelf's, so the clear space above it keeps its own number).
        const offset = axis === 'height' ? [8, 0] : axis === 'depth' ? [-8, 0] : [0, 6];
        const side = axis === 'height' ? [ew / 2 + 14, 0] : axis === 'depth' ? [-ew / 2 - 8, 0] : axis === 'under' ? [0, eh / 2 + 9] : [0, -eh / 2 - 7];
        let ax = a.x + offset[0], ay = a.y + offset[1], bx = b.x + offset[0], by = b.y + offset[1], x = (ax + bx) / 2 + side[0], y = (ay + by) / 2 + side[1];
        if (axis === 'height' && Math.abs(by - ay) > 80) {
            y = ay + (by - ay) * .28;
        }
        const dx = Math.max(bounds.left + ew / 2, Math.min(bounds.right - ew / 2, x)) - x, dy = Math.max(eh / 2 + 6, Math.min(bounds.bottom - eh / 2, y)) - y;
        // `line` is where the dimension line belongs; a/b are moved only to keep the label on screen.
        return { a: { x: ax + dx, y: ay + dy }, b: { x: bx + dx, y: by + dy }, line: { a, b }, x: x + dx, y: y + dy };
    }
    function bindRuler(el, a, b, axis) {
        const entry = renderState.labs.find(l => l.el === el);
        if (entry) {
            entry.ruler = { a: a.clone(), b: b.clone(), axis };
        }
    }
    function drawScreenRuler(l, r, ew, eh, bounds) {
        const project = p => {
            const q = p.clone();
            if (l.owner) {
                l.owner.localToWorld(q);
            }
            q.project(resources.cam);
            return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height };
        };
        const a = project(l.ruler.a), b = project(l.ruler.b), placed = rulerScreenPlacement(a, b, l.ruler.axis, ew, eh, bounds);
        // Shape measurements keep their line on the corner they measure; only their label moves.
        const keepLine = l.el.classList.contains('shape-coord') || l.el.classList.contains('shape-measure');
        const q = keepLine ? { ...placed, a: placed.line.a, b: placed.line.b } : placed;
        const len = Math.hypot(q.b.x - q.a.x, q.b.y - q.a.y) || 1, nx = -(q.b.y - q.a.y) / len * 4, ny = (q.b.x - q.a.x) / len * 4;
        if (!l.rulerNode) {
            const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
            svg.classList.add('measurement-line');
            svg.setAttribute('aria-hidden', 'true');
            svg.appendChild(path);
            $('#labels').prepend(svg);
            l.rulerNode = svg;
        }
        const p = l.rulerNode.firstChild;
        p.setAttribute('d', `M${a.x},${a.y} L${q.a.x},${q.a.y} M${b.x},${b.y} L${q.b.x},${q.b.y} M${q.a.x},${q.a.y} L${q.b.x},${q.b.y} M${q.a.x - nx},${q.a.y - ny} L${q.a.x + nx},${q.a.y + ny} M${q.b.x - nx},${q.b.y - ny} L${q.b.x + nx},${q.b.y + ny}`);
        l.rulerNode.style.display = l.el.classList.contains('held') ? 'none' : 'block';
        return q;
    }
    function dimensionStroke(points, group = renderState.Gr, order = 10) {
        const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: new THREE.Color('#8d7d65').convertSRGBToLinear(), toneMapped: false, transparent: true, opacity: .65, depthTest: false, depthWrite: false }));
        line.renderOrder = order;
        group.add(line);
        return line;
    }
    return { rulerScreenPlacement, bindRuler, drawScreenRuler, dimensionStroke, label };
}
