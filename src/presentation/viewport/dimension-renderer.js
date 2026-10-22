import * as THREE from "three";
import { decorateDimensionScrubber } from './dimension-scrubber-label';
import { rulerScreenPlacement } from './ruler-layout';
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
    function bindRuler(el, a, b, axis) {
        const entry = renderState.labs.find(l => l.el === el);
        if (entry) {
            entry.ruler = { a: a.clone(), b: b.clone(), axis };
        }
    }
    function drawScreenRuler(l, r, ew, eh, bounds) {
        const project = p => {
            const q = p.clone();
            if (l.owner) l.owner.localToWorld(q);
            q.project(resources.cam);
            return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height, z: q.z };
        };
        const a = project(l.ruler.a), b = project(l.ruler.b);
        // Never pin a measurement from behind the camera or from an offscreen edge to the viewport border.
        const visible = [a, b].every(p => Number.isFinite(p.x + p.y + p.z) && p.z >= -1 && p.z <= 1)
            && Math.max(a.x, b.x) >= 0 && Math.min(a.x, b.x) <= r.width
            && Math.max(a.y, b.y) >= 0 && Math.min(a.y, b.y) <= r.height;
        const placed = rulerScreenPlacement(a, b, l.ruler.axis, ew, eh, bounds);
        l.rulerLayout = { ...placed, sourceA: a, sourceB: b, visible, w: ew, h: eh };
        if (!l.rulerNode) {
            const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
            svg.classList.add('measurement-line');
            svg.setAttribute('aria-hidden', 'true');
            svg.appendChild(document.createElementNS(ns, 'path'));
            l.rulerNode = svg;
        }
        l.rulerNode.classList.toggle('assist-ruler', l.el.classList.contains('assist-gap'));
        if (!l.rulerNode.isConnected) $('#labels').prepend(l.rulerNode);
        return { ...placed, visible };
    }
    /** Called after overlap handling so the final value and its witness line can never drift apart. */
    function finishScreenRuler(l, shift = { x: 0, y: 0 }) {
        const q = l.rulerLayout;
        if (!q || !l.rulerNode) return;
        const visible = q.visible && l.el.style.display !== 'none' && !l.el.classList.contains('held');
        l.rulerNode.style.display = visible ? 'block' : 'none';
        if (!visible) return;
        const { a, b, sourceA: sa, sourceB: sb } = q, nx = q.normal.x * 4, ny = q.normal.y * 4;
        const x = q.x + shift.x, y = q.y + shift.y;
        // Leader terminates at the label's rectangle, leaving both measured corners untouched.
        const dx = q.anchor.x - x, dy = q.anchor.y - y;
        const t = Math.min(1, Math.abs(dx) > .001 ? q.w / 2 / Math.abs(dx) : Infinity,
            Math.abs(dy) > .001 ? q.h / 2 / Math.abs(dy) : Infinity);
        l.rulerNode.firstChild.setAttribute('d',
            `M${sa.x},${sa.y} L${a.x},${a.y} M${sb.x},${sb.y} L${b.x},${b.y} `
            + `M${a.x},${a.y} L${b.x},${b.y} M${a.x - nx},${a.y - ny} L${a.x + nx},${a.y + ny} `
            + `M${b.x - nx},${b.y - ny} L${b.x + nx},${b.y + ny} `
            + `M${q.anchor.x},${q.anchor.y} L${x + dx * t},${y + dy * t}`);
    }
    function dimensionStroke(points, group = renderState.Gr, order = 10) {
        const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: new THREE.Color('#8d7d65').convertSRGBToLinear(), toneMapped: false, transparent: true, opacity: .65, depthTest: false, depthWrite: false }));
        line.renderOrder = order;
        group.add(line);
        return line;
    }
    return { rulerScreenPlacement, bindRuler, drawScreenRuler, finishScreenRuler, dimensionStroke, label };
}
