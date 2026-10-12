import * as THREE from 'three';
import type { RoomHandle, RoomMeasure } from '../editor/studio-editor.ports';
import type { Guide } from '../editor/studio-drag';

type Lab = { p: THREE.Vector3; el: HTMLElement; owner?: THREE.Object3D; rulerNode?: Element; ruler?: unknown };
interface StudioOverlayPorts {
    readonly document: { createElement: Document['createElement'] };
    readonly labels: () => HTMLElement;
    readonly scene: THREE.Scene;
    readonly camera: THREE.Camera;
    readonly canvas: HTMLCanvasElement;
    readonly renderState: { labs: Lab[] };
    readonly label: (p: THREE.Vector3, text: string, cls: string) => HTMLElement;
    readonly bindRuler: (el: HTMLElement, a: THREE.Vector3, b: THREE.Vector3, axis: string) => void;
    readonly editor: {
        handles(): RoomHandle[]; measures(): RoomMeasure[]; guides(): readonly Guide[];
        reason(): { text: string; x: number; y: number; z: number } | null;
        begin(e: PointerEvent, h: RoomHandle, el: HTMLElement): void; move(e: PointerEvent): void; end(cancel?: boolean): void;
        nudge(h: RoomHandle, key: string, shift: boolean): boolean; dragging(): boolean;
    };
}

const V = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z);
const ARROWS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/></svg>';
const SLIDE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>';

/** Draws the room editor's handles, live rulers, guides and refusal reasons over the model, with the
 * same label system, classes and placement rules as the shape editor. Handles are pooled by key, so a
 * handle being dragged keeps its pointer while everything around it is redrawn. */
export function createStudioOverlay({ document, labels, scene, camera, canvas, renderState, label, bindRuler, editor }: StudioOverlayPorts) {
    const pool = new Map<string, HTMLButtonElement>(), current = new Map<HTMLButtonElement, RoomHandle>();
    const guideGroup = new THREE.Group();
    guideGroup.name = 'studio-guides';
    scene.add(guideGroup);
    const guideMaterial = new THREE.LineDashedMaterial({ color: new THREE.Color('#5f9f78').convertSRGBToLinear(), toneMapped: false, dashSize: 6, gapSize: 4, transparent: true, opacity: .95, depthTest: false });
    const faceLines = new Map<string, THREE.Line>();
    const axisMaterial = new THREE.LineBasicMaterial({ color: 0x8d7d65, transparent: true, opacity: .65, depthTest: false });
    let mine: Lab[] = [];

    function handleElement(h: RoomHandle) {
        let el = pool.get(h.key);
        if (!el) {
            el = document.createElement('button');
            el.type = 'button';
            el.className = h.kind === 'face' ? 'lbl shape-handle wardrobe-move room-handle room-face' : h.kind === 'rotate' ? 'lbl ground-rotate room-handle room-rotate'
                : h.axis ? 'lbl wardrobe-move room-handle room-axis'
                    : 'lbl shape-handle room-handle ' + (h.kind === 'corner' ? 'point' : h.kind === 'extend' ? 'split-handle' : 'room-grip');
            if (h.axis || h.kind === 'face') {
                if (h.axis) el.dataset.axis = h.axis;
                if (h.dimension) { el.dataset.dimension = h.dimension; el.dataset.side = String(h.side); }
                el.innerHTML = '<span class="mv-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25"'
                    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4"/></svg></span>';
            }
            else if (h.kind === 'rotate') el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25"'
                + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/></svg>';
            else if (h.kind === 'extend') el.textContent = '+';
            else if (h.kind !== 'corner') el.innerHTML = h.kind === 'wall' ? ARROWS : SLIDE;
            const button = el;
            el.onpointerdown = e => { const x = current.get(button); if (x) editor.begin(e, x, button); };
            el.onpointermove = e => editor.move(e);
            el.onpointerup = () => editor.end();
            el.onpointercancel = () => editor.end(true);
            el.onlostpointercapture = () => { if (editor.dragging()) editor.end(); };
            el.onkeydown = e => {
                const x = current.get(button);
                if (!x || !e.key.startsWith('Arrow')) return;
                e.preventDefault();
                e.stopPropagation();
                editor.nudge(x, e.key, e.shiftKey);
            };
            pool.set(h.key, el);
        }
        el.setAttribute('aria-label', h.label);
        el.title = h.label;
        return el;
    }

    /** Removes what the last draw added; pooled handles stay in place until they are not needed. */
    function clear() {
        const set = new Set(mine);
        for (const l of mine) { if (!l.el.classList.contains('room-handle')) l.el.remove(); l.rulerNode?.remove(); }
        renderState.labs = renderState.labs.filter(l => !set.has(l));
        mine = [];
        guideGroup.children.forEach(o => (o as THREE.Line).geometry.dispose());
        guideGroup.clear();
        faceLines.clear();
    }
    function track<T extends HTMLElement>(el: T, p: THREE.Vector3) {
        const entry = renderState.labs.find(l => l.el === el) ?? { p, el };
        // Room parts are placed in scene coordinates, not in a wardrobe's.
        entry.p = p;
        delete entry.owner;
        if (!renderState.labs.includes(entry)) renderState.labs.push(entry);
        mine.push(entry);
        return el;
    }

    function draw() {
        clear();
        const handles = editor.handles(), used = new Set<string>();
        current.clear();
        for (const g of editor.guides()) {
            const a = new THREE.Vector3(g.a.x, .6, g.a.z), b = new THREE.Vector3(g.b.x, .6, g.b.z);
            if (a.distanceTo(b) > 1) {
                const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), guideMaterial);
                line.computeLineDistances();
                line.renderOrder = 16;
                guideGroup.add(line);
            }
            track(label(b.clone().add(new THREE.Vector3(0, 18, 0)), g.label, 'lbl shape-guide room-label'), b.clone().add(new THREE.Vector3(0, 18, 0)));
        }
        for (const m of editor.measures()) {
            const a = V(m.a), b = V(m.b), el = label(a.clone().add(b).multiplyScalar(.5), m.text, 'lbl dim space-ruler item-dimension shape-measure room-label');
            track(el, a.clone().add(b).multiplyScalar(.5));
            bindRuler(el, a, b, 'width');
        }
        const why = editor.reason();
        if (why) track(label(V(why), why.text, 'lbl shape-reason room-label'), V(why));
        for (const h of handles) {
            if (h.kind === 'face') {
                const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(h), V(h)]), axisMaterial);
                leader.renderOrder = 16;
                faceLines.set(h.key, leader);
                guideGroup.add(leader);
            }
            if (h.axis) {
                const direction = new THREE.Vector3(h.axis === 'x' ? 1 : 0, h.axis === 'y' ? 1 : 0, h.axis === 'z' ? 1 : 0);
                const anchor = V(h).addScaledVector(direction, -65), tip = V(h).addScaledVector(direction, -8);
                const side = direction.clone().cross(new THREE.Vector3(0, 1, 0));
                if (side.lengthSq() < .01) side.set(1, 0, 0);
                side.normalize();
                const head = tip.clone().addScaledVector(direction, -5);
                const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([anchor, tip, tip, head.clone().addScaledVector(side, 2), tip, head.clone().addScaledVector(side, -2)]), axisMaterial);
                line.renderOrder = 16;
                guideGroup.add(line);
            }
            const el = handleElement(h);
            used.add(h.key);
            current.set(el, h);
            if (!el.isConnected) labels().appendChild(el);
            track(el, V(h));
        }
        // The dragged handle is always among them (the editor keeps it), so it never loses its pointer.
        for (const [key, el] of pool) if (!used.has(key)) { el.remove(); pool.delete(key); }
        orient();
    }

    /** Wall grips point along the wall's room side on screen; opening grips along the wall. */
    function orient() {
        const r = canvas.getBoundingClientRect();
        const screen = (p: THREE.Vector3) => { const q = p.clone().project(camera); return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height }; };
        const occupied: { x: number; y: number; size: number }[] = [];
        // Movement and rotation grips take priority; thin solids still have separate touchable faces.
        const entries = [...current].sort((a, b) => Number(a[1].kind === 'face') - Number(b[1].kind === 'face'));
        for (const [el, h] of entries) {
            const source = V(h), projected = source.clone().project(camera), origin = screen(source);
            let x = origin.x, y = origin.y;
            if (h.kind === 'face') {
                const direction = new THREE.Vector3(h.nx ?? 0, h.dimension === 'height' ? h.side! : 0, h.nz ?? 0);
                const b = screen(source.clone().addScaledVector(direction, 40));
                const length = Math.hypot(b.x - origin.x, b.y - origin.y);
                const ux = length > .1 ? (b.x - origin.x) / length : h.side!, uy = length > .1 ? (b.y - origin.y) / length : 0;
                const size = r.width <= 900 ? 44 : 32;
                const clamp = (p: { x: number; y: number }) => ({
                    x: Math.max(size / 2 + 6, Math.min(r.width - size / 2 - 6, p.x)),
                    y: Math.max(size / 2 + 6, Math.min(r.height - size / 2 - 80, p.y)),
                });
                const clear = (p: { x: number; y: number }) => !occupied.some(q => Math.abs(p.x - q.x) < (size + q.size) / 2 + 5 && Math.abs(p.y - q.y) < (size + q.size) / 2 + 5);
                // Prefer the face's own direction. At a screen edge, fan out rather than stack targets.
                const candidates: { x: number; y: number }[] = [];
                for (let offset = 22; offset <= 180; offset += 6) candidates.push(clamp({ x: origin.x + ux * offset, y: origin.y + uy * offset }));
                for (let radius = 28; radius <= 224; radius += 28) for (let i = 0; i < 12; i++) {
                    const angle = Math.atan2(uy, ux) + i * Math.PI / 6;
                    candidates.push(clamp({ x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius }));
                }
                const spot = candidates.find(clear) ?? candidates[0]!;
                x = spot.x; y = spot.y;
                const world = new THREE.Vector3(x / r.width * 2 - 1, 1 - y / r.height * 2, projected.z).unproject(camera);
                const entry = mine.find(l => l.el === el);
                if (entry) entry.p.copy(world);
                faceLines.get(h.key)?.geometry.setFromPoints([source, world]);
                const icon = el.querySelector<HTMLElement>('.mv-ic');
                if (icon) icon.style.transform = 'rotate(' + Math.atan2(uy, ux).toFixed(3) + 'rad)';
                occupied.push({ x, y, size });
                continue;
            }
            occupied.push({ x, y, size: r.width <= 900 ? 44 : 32 });
            const dx = h.kind === 'wall' ? h.nx : h.kind === 'opening' ? h.ux : undefined, dz = h.kind === 'wall' ? h.nz : h.uz;
            if (h.axis) {
                const a = screen(V(h)), b = screen(V(h).add(new THREE.Vector3(h.axis === 'x' ? 40 : 0, h.axis === 'y' ? 40 : 0, h.axis === 'z' ? 40 : 0)));
                const icon = el.querySelector<HTMLElement>('.mv-ic');
                if (icon) icon.style.transform = 'rotate(' + Math.atan2(b.y - a.y, b.x - a.x).toFixed(3) + 'rad)';
                continue;
            }
            if (dx === undefined || dz === undefined) continue;
            const a = screen(V(h)), b = screen(new THREE.Vector3(h.x + dx * 40, h.y, h.z + dz * 40));
            const turn = Math.atan2(b.y - a.y, b.x - a.x) - (h.kind === 'wall' ? Math.PI / 2 : 0);
            const svg = el.firstElementChild as SVGElement | null;
            if (svg) svg.style.transform = 'rotate(' + turn.toFixed(3) + 'rad)';
        }
    }

    return {
        draw, orient,
        dispose() { clear(); pool.forEach(el => el.remove()); pool.clear(); guideMaterial.dispose(); axisMaterial.dispose(); scene.remove(guideGroup); },
    };
}
