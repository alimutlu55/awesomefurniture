import * as THREE from 'three';
import { sceneMeasurementBadge } from '../editor/scene-measurement-badge';
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
        begin(e: PointerEvent, h: RoomHandle, el: HTMLElement): void; move(e: PointerEvent): void; end(cancel?: boolean): boolean;
        nudge(h: RoomHandle, key: string, shift: boolean): boolean; dragging(): boolean; editMeasure(m: RoomMeasure): void; dragKey(): string | null;
        click(h: RoomHandle): void;
        selection(): import('./studio-renderer').RoomSelection;
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
    let mine: Lab[] = [];

    function handleElement(h: RoomHandle) {
        let el = pool.get(h.key);
        if (!el) {
            el = document.createElement('button');
            el.type = 'button';
            const split = h.kind === 'extend';
            el.className = 'lbl shape-handle room-handle ' + (h.kind === 'corner' ? 'point' : split ? 'split-handle' : 'room-grip');
            if (split) el.textContent = '+';
            else if (h.kind === 'depth' || h.kind === 'tilt') el.innerHTML = ARROWS;
            else if (h.kind !== 'corner') el.innerHTML = SLIDE;
            const button = el;
            el.onpointerdown = e => {
                let target = button, h = current.get(button);
                const own = button.getBoundingClientRect();
                let distance = Math.hypot(e.clientX - own.left - own.width / 2, e.clientY - own.top - own.height / 2);
                if (h && ['depth', 'tilt'].includes(h.kind)) for (const [dot, point] of current) {
                    if (!['depth', 'tilt'].includes(point.kind)) continue;
                    const r = dot.getBoundingClientRect(), d = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
                    if (d <= 32 && d < distance) { target = dot; h = point; distance = d; }
                }
                if (h) editor.begin(e, h, target);
            };
            el.onpointermove = e => editor.move(e);
            el.onpointerup = () => editor.end();
            el.onclick = e => { const x = current.get(button); if (e.detail === 0 && x) editor.click(x); };
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
            const a = new THREE.Vector3(g.a.x, g.a.y ?? .6, g.a.z), b = new THREE.Vector3(g.b.x, g.b.y ?? .6, g.b.z);
            if (a.distanceTo(b) > 1) {
                const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), guideMaterial);
                line.computeLineDistances();
                line.renderOrder = 16;
                guideGroup.add(line);
            }
            // Snap guides are lines without words; only a corner's angle shows, as a number (green when square or straight).
            if (g.info !== undefined) track(label(b.clone().add(new THREE.Vector3(0, 18, 0)), g.label, g.info ? 'lbl room-angle room-label' : 'lbl shape-guide room-label'), b.clone().add(new THREE.Vector3(0, 18, 0)));
        }
        for (const m of editor.measures()) {
            const a = V(m.a), b = V(m.b), el = label(a.clone().add(b).multiplyScalar(.5), m.text, 'lbl dim space-ruler item-dimension shape-measure room-label' + (m.tone ? ' room-warn' : ''));
            const selected = editor.selection();
            if (m.edit && selected) sceneMeasurementBadge(el, { kind: 'studio', selection: selected.kind, id: selected.id, field: m.edit },
                selected.kind === 'ceiling' ? 'Ceiling height' : selected.kind === 'opening' ? 'Opening ' + m.edit
                    : selected.kind === 'fixture' ? (m.edit === 'left' ? 'From left end' : m.edit === 'right' ? 'From right end' : 'Size') : 'Wall length',
                Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y, m.b.z - m.a.z), m.axis === 'height' ? 'vertical' : 'horizontal');
            track(el, a.clone().add(b).multiplyScalar(.5));
            bindRuler(el, a, b, m.axis ?? 'width');
        }
        const why = editor.reason();
        if (why) track(label(V(why), why.text, 'lbl shape-reason room-label'), V(why));
        // While a part is dragged, its handle stays and every other handle on the model steps aside.
        const dragged = editor.dragKey();
        labels().toggleAttribute('data-room-drag', !!dragged);
        // Editing the room, the wardrobes' own measurements step aside.
        labels().toggleAttribute('data-room-edit', handles.length > 0 || !!editor.selection());
        for (const h of handles) {
            const el = handleElement(h);
            el.classList.toggle('dragging', h.key === dragged);
            used.add(h.key);
            current.set(el, h);
            if (!el.isConnected) labels().appendChild(el);
            track(el, V(h));
        }
        // The dragged handle is always among them (the editor keeps it), so it never loses its pointer.
        for (const [key, el] of pool) if (!used.has(key)) { el.remove(); pool.delete(key); }
        orient();
    }

    /** A depth grip points into the room on screen. */
    function orient() {
        const r = canvas.getBoundingClientRect();
        const screen = (p: THREE.Vector3) => { const q = p.clone().project(camera); return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height }; };
        for (const [el, h] of current) {
            const dx = h.kind === 'depth' ? h.nx : undefined, dz = h.nz;
            if (dx === undefined || dz === undefined) continue;
            const a = screen(V(h)), b = screen(new THREE.Vector3(h.x + dx * 40, h.y, h.z + dz * 40));
            const turn = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
            const svg = el.firstElementChild as SVGElement | null;
            if (svg) svg.style.transform = 'rotate(' + turn.toFixed(3) + 'rad)';
        }
    }

    return {
        draw, orient,
        dispose() { clear(); pool.forEach(el => el.remove()); pool.clear(); guideMaterial.dispose(); scene.remove(guideGroup); },
    };
}
