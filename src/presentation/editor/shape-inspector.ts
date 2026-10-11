import type { EditorState } from '../../application/projects/editor-scene';
import type { createSceneCommands } from '../../application/commands/scene-commands';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import {
    addStep, MIN_SEGMENT, partitionPositions, removePoint, resolveShape, setPanelAngle, setPoint, setStepRise, shapePanels, shapeProblems, splitPanel,
    type ShapeTemplateId, type WardrobeShape,
} from '../../domain/wardrobe/shape/wardrobe-shape';
import { shapeTemplates, templateArt } from './shape-art';
import { measureNumber, esc } from './editor-format.js';

interface ShapeInspectorPorts {
    dom: {
        $<E extends HTMLElement = HTMLElement>(selector: string): E;
        document: { createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] };
    };
    model: { activeCabinet(): { state: EditorState }; snapshot(): string; restore(raw: string): void };
    sceneCommands: Pick<ReturnType<typeof createSceneCommands>, 'applyShapeTemplate' | 'setShape'>;
    picking: { frontPoint(e: PointerEvent): { x: number; y: number } | null };
    selectionState: { shapeEditing?: boolean; focusOn: boolean };
    callbacks: { refresh(): void; rebuild(): void; histUI(): void };
}
interface HandleDrag {
    index: number; pointer: number; target: HTMLElement; snapshot: string;
    start: { x: number; y: number }; original: WardrobeShape; last: WardrobeShape; moved: boolean;
    lockX: { v: number; label: string } | null; lockY: { v: number; label: string } | null;
    guides: { orient: 'h' | 'v'; pos: number; label: string }[];
}

/** Wardrobe-level skeleton editing: template choice, a precise panel list and
 * draggable break points on the model. Every change goes through scene commands,
 * which validate the geometry and refit fittings. */
export function createShapeInspector({ dom, model, sceneCommands, picking, selectionState, callbacks }: ShapeInspectorPorts) {
    let drag: HandleDrag | null = null;
    const state = () => model.activeCabinet().state;
    /** Editable skeleton; a regular wardrobe becomes a custom one once edited. */
    const current = (): WardrobeShape => resolveShape(state());
    const editable = (shape: WardrobeShape): WardrobeShape => state().shape ? shape : { ...shape, template: 'custom' };
    const f = (v: number) => measureNumber(Math.round(v * 10) / 10);
    /** Coordinates keep their sign and one decimal, unlike the clamped measure format. */
    const cm = (v: number) => String(Math.round(v * 10) / 10);
    /** Number inputs need a dot decimal, whatever the display locale. */
    const raw = (v: number) => String(Math.round(v * 10) / 10);

    function commit(next: WardrobeShape) {
        if (sceneCommands.setShape(editable(next))) callbacks.refresh();
        else render();
    }
    function chooseTemplate(id: ShapeTemplateId) {
        const active = state().shape?.template ?? 'regular';
        if (id === active && id !== 'custom') return;
        if (sceneCommands.applyShapeTemplate(id)) {
            selectionState.shapeEditing = id !== 'regular';
            callbacks.refresh();
        }
    }

    function field(label: string, data: Record<string, string | number>, value: number, opts: { min?: number; max?: number; step?: number; unit?: string } = {}) {
        const attrs = Object.entries(data).map(([k, v]) => ' data-' + k + '="' + v + '"').join('');
        return '<label class="shape-field"><span>' + label + '</span><span class="shape-input"><input type="number" inputmode="decimal" step="' + (opts.step ?? .5) + '"' + (opts.min !== undefined ? ' min="' + opts.min + '"' : '') + (opts.max !== undefined ? ' max="' + opts.max + '"' : '') + attrs + ' value="' + raw(value) + '" aria-label="' + esc(label) + '"><small>' + (opts.unit ?? 'cm') + '</small></span></label>';
    }
    const action = (name: string, title: string, data: Record<string, number>, path: string) =>
        '<button type="button" class="shape-action" data-action="' + name + '"' + Object.entries(data).map(([k, v]) => ' data-' + k + '="' + v + '"').join('') + ' title="' + esc(title) + '" aria-label="' + esc(title) + '"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg></button>';

    const TRASH = 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13';
    const row = (kind: string, k: number, label: string, meta: string, actions: string, fields: string) =>
        '<div class="shape-row' + (kind ? ' ' + kind : '') + '" data-' + (kind === 'panel' ? 'segment' : 'point') + '="' + k + '"><div class="shape-row-head"><b>' + esc(label) + '</b>' + (meta ? '<small>' + esc(meta) + '</small>' : '') + '<span class="shape-actions">' + actions + '</span></div><div class="shape-fields">' + fields + '</div></div>';
    function render() {
        const templates = dom.$('#shape-templates'), panels = dom.$('#shape-panels'), fold = dom.$<HTMLDetailsElement>('#shape-fold');
        const active = state().shape?.template ?? 'regular';
        templates.innerHTML = shapeTemplates().map(t => '<button type="button" class="shape-chip' + (t.id === active ? ' on' : '') + '" data-template="' + t.id + '" aria-pressed="' + (t.id === active) + '" title="' + esc(t.name + ' · ' + t.description) + '">' + templateArt(t.id, true) + '<span>' + esc(t.name) + '</span></button>').join('');
        fold.open = !!selectionState.shapeEditing;
        const shape = current(), pts = shape.top, rows: string[] = [], panelsList = shapePanels(shape);
        const point = (k: number, label: string, withX: boolean) => {
            rows.push(row('', k, label, '', withX ? action('remove', 'Remove ' + label.toLowerCase(), { p: k }, TRASH) : '', (withX ? field('From left', { p: k, k: 'x' }, pts[k]!.x, { min: 0, max: state().w }) : '') + field('Height', { p: k, k: 'y' }, pts[k]!.y, { min: 40, max: 280 })));
        };
        let breaks = 0, steps = 0;
        point(0, 'Left side', false);
        for (let k = 0; k < pts.length - 1; k++) {
            const a = pts[k]!, b = pts[k + 1]!;
            if (b.x - a.x > 1e-6) {
                const panel = panelsList.find(p => p.kind === 'top' && p.from === k)!;
                rows.push(row('panel', k, panel.label, 'Board ' + f(panel.length) + ' cm', action('split', 'Add a break point to ' + panel.label.toLowerCase(), { s: k }, 'M4 16 12 8l8 8M12 8v.01') + action('step', 'Add a step to ' + panel.label.toLowerCase(), { s: k }, 'M4 8h8v8h8'),
                    field('Angle', { s: k, k: 'angle' }, panel.angle, { min: -70, max: 70, step: .5, unit: '°' }) + '<span class="shape-field shape-readout"><span>Width</span><b>' + f(b.x - a.x) + ' cm</b></span>'));
                if (k + 1 < pts.length - 1 && !(pts[k + 2] && Math.abs(pts[k + 2]!.x - b.x) < 1e-6)) point(k + 1, 'Break ' + ++breaks, true);
            }
            else {
                const label = 'Step ' + ++steps, anchored = a.partition !== undefined && a.partition === b.partition;
                rows.push(row('step', k, label, anchored ? 'On partition ' + (a.partition! + 1) : '', action('remove', 'Remove ' + label.toLowerCase(), { p: k }, TRASH),
                    field('From left', { p: k, k: 'x' }, a.x, { min: 0, max: state().w }) + field('Rise', { p: k, k: 'rise' }, b.y - a.y, { min: -240, max: 240 }) + field('Left height', { p: k, k: 'y' }, a.y) + field('Right height', { p: k + 1, k: 'y' }, b.y)));
            }
        }
        point(pts.length - 1, 'Right side', false);
        const lowest = Math.min(...pts.map(p => p.y)), tallest = Math.max(...pts.map(p => p.y));
        panels.innerHTML = '<p class="shape-summary">' + (lowest === tallest ? 'Flat top · ' + f(tallest) + ' cm' : f(lowest) + '–' + f(tallest) + ' cm tall') + ' · drag the dots on the model or enter exact sizes.</p>' + rows.join('');
    }

    /** Commit a typed value. Angles pivot on the panel's left end. */
    function onChange(input: HTMLInputElement) {
        const value = input.valueAsNumber, shape = current();
        if (!Number.isFinite(value)) { render(); return; }
        if (input.dataset.k === 'angle') commit(setPanelAngle(shape, Number(input.dataset.s), value));
        else if (input.dataset.k === 'rise') commit(setStepRise(shape, Number(input.dataset.p), value));
        else commit(setPoint(shape, Number(input.dataset.p), input.dataset.k === 'x' ? { x: value } : { y: value }));
    }
    function onAction(button: HTMLButtonElement) {
        const shape = current(), name = button.dataset.action;
        const next = name === 'split' ? splitPanel(shape, Number(button.dataset.s)) : name === 'step' ? addStep(shape, Number(button.dataset.s), Math.min(20, Math.max(...shape.top.map(p => p.y)) - 60)) : removePoint(shape, Number(button.dataset.p));
        if (next === shape || JSON.stringify(next.top) === JSON.stringify(shape.top)) {
            callbacks.refresh();
            return;
        }
        commit(next);
    }

    function bind(listen: (target: EventTarget, type: string, handler: (e: Event) => void) => void) {
        listen(dom.$('#shape-templates'), 'click', e => {
            const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-template]');
            if (button) chooseTemplate(button.dataset.template as ShapeTemplateId);
        });
        const panels = dom.$('#shape-panels');
        listen(panels, 'change', e => {
            const input = e.target as HTMLInputElement;
            if (input.matches('input[type="number"]')) onChange(input);
        });
        listen(panels, 'keydown', e => {
            const input = e.target as HTMLInputElement;
            if ((e as KeyboardEvent).key === 'Enter' && input.matches('input')) input.blur();
        });
        listen(panels, 'click', e => {
            const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
            if (button) onAction(button);
        });
        listen(dom.$('#shape-fold'), 'toggle', () => {
            const open = dom.$<HTMLDetailsElement>('#shape-fold').open;
            if (open === !!selectionState.shapeEditing) return;
            selectionState.shapeEditing = open;
            callbacks.rebuild();
        });
    }

    /** Model handles: one per profile point, in cabinet-local coordinates. */
    /** Break points are always reachable on the model; the panel list only adds precision. */
    function handles() {
        const shape = current(), w = state().w;
        return shape.top.map((p, index, all) => ({
            index, x: p.x - w / 2, y: p.y,
            movesX: index > 0 && index < all.length - 1,
            label: 'x ' + cm(p.x) + ' · y ' + cm(p.y),  // accessible name only; the handle shows a dot
        }));
    }
    /** "+" markers at the middle of every top panel wide enough to split. */
    function splitMarkers() {
        const shape = current(), w = state().w, out: { index: number; x: number; y: number }[] = [];
        for (let k = 0; k < shape.top.length - 1; k++) {
            const a = shape.top[k]!, b = shape.top[k + 1]!;
            if (b.x - a.x >= 2 * MIN_SEGMENT - 1e-6) out.push({ index: k, x: (a.x + b.x) / 2 - w / 2, y: (a.y + b.y) / 2 });
        }
        return out;
    }
    /** Live measurements as rulers, like the item rulers: a top panel gets a line
     * offset above it, a step a line beside its riser. Endpoints are cabinet-centred. */
    function measures() {
        const shape = current(), w = state().w, out: { a: { x: number; y: number }; b: { x: number; y: number }; text: string; axis: 'width' | 'height' }[] = [];
        const OFF = 8;
        for (const panel of shapePanels(shape)) {
            if (panel.kind === 'top') {
                const a = shape.top[panel.from]!, b = shape.top[panel.to]!;
                out.push({ a: { x: a.x - w / 2, y: a.y + OFF }, b: { x: b.x - w / 2, y: b.y + OFF }, text: f(panel.length) + ' cm · ' + Math.round(panel.angle) + '°', axis: 'width' });
            }
            else if (panel.kind === 'step') {
                const a = shape.top[panel.from]!, b = shape.top[panel.to]!, rise = b.y - a.y, x = a.x - w / 2 + (rise > 0 ? -OFF : OFF);
                out.push({ a: { x, y: Math.min(a.y, b.y) }, b: { x, y: Math.max(a.y, b.y) }, text: (rise > 0 ? '+' : '') + String(Math.round(rise * 10) / 10) + ' cm', axis: 'height' });
            }
        }
        return out;
    }
    function split(index: number) {
        const shape = current(), next = splitPanel(shape, index);
        if (next !== shape) commit(next);
    }
    /** Snapping and guides follow the item rules: a tolerance of about 8 screen pixels
     * (so it feels the same at any zoom), a lock that holds the line it caught, and a
     * guide drawn across the model with its name. */
    let pxPerCm = 4;
    function setScale(value: number) { pxPerCm = Math.max(.5, value); }
    const tolerance = () => Math.max(.4, Math.min(4, 8 / pxPerCm));
    type Align = { v: number; label: string };
    function breakName(shape: WardrobeShape, k: number) {
        if (k === 0) return 'left side';
        if (k === shape.top.length - 1) return 'right side';
        let n = 0;
        for (let j = 1; j <= k; j++) if (Math.abs(shape.top[j]!.x - shape.top[j - 1]!.x) > 1e-6 || j === k) n++;
        return 'break ' + n;
    }
    /** Heights a point can level with: the other break points. */
    function heightTargets(o: WardrobeShape, index: number): Align[] {
        return o.top.flatMap((q, k) => k === index ? [] : [{ v: q.y, label: 'Level with ' + breakName(o, k) }]);
    }
    /** Positions a point can align with: sides, centre, partitions and other break points. */
    function positionTargets(o: WardrobeShape, index: number): Align[] {
        const w = state().w, out: Align[] = [{ v: 0, label: 'Flush with left side' }, { v: w, label: 'Flush with right side' }, { v: w / 2, label: 'Centred' }];
        for (const x of partitionPositions(state())) out.push({ v: x, label: 'Aligned with partition' }, { v: x + PANEL, label: 'Aligned with partition' });
        o.top.forEach((q, k) => { if (k !== index && k > 0 && k < o.top.length - 1) out.push({ v: q.x, label: 'Aligned with ' + breakName(o, k) }); });
        return out;
    }
    /** Nearest target within tolerance; a lock keeps the target it caught until the pointer leaves it. */
    function alignTo(raw: number, targets: Align[], lock: Align | null): Align | null {
        const tol = tolerance();
        if (lock) {
            const same = targets.find(t => Math.abs(t.v - lock.v) < 1e-6 && t.label === lock.label);
            if (same && Math.abs(same.v - raw) <= tol * 1.6) return same;
        }
        let best: Align | null = null, bestD = Infinity;
        for (const t of targets) {
            const d = Math.abs(t.v - raw);
            if (d <= tol && d < bestD) { best = t; bestD = d; }
        }
        return best;
    }
    const roundCm = (v: number) => Math.round(v * 10) / 10;
    /** Live X and Y rulers for the break point being dragged: X from the left side,
     * Y from the floor. Cabinet-centred endpoints, rebuilt on every move. */
    function dragRulers() {
        const g = drag;
        if (!g) return [];
        const p = g.last.top[g.index]!, w = state().w, x = p.x - w / 2, out: { a: { x: number; y: number }; b: { x: number; y: number }; text: string; axis: 'width' | 'height' }[] = [];
        if (p.x > .5) out.push({ a: { x: -w / 2, y: p.y }, b: { x, y: p.y }, text: 'x ' + cm(p.x) + ' cm', axis: 'width' });
        if (p.y > .5) out.push({ a: { x, y: 0 }, b: { x, y: p.y }, text: 'y ' + cm(p.y) + ' cm', axis: 'height' });
        return out;
    }
    /** Guides for the current drag: horizontal for heights, vertical for positions. */
    function guides(): { orient: 'h' | 'v'; pos: number; label: string }[] {
        return drag?.guides ?? [];
    }
    function beginHandleDrag(e: PointerEvent, index: number, target: HTMLElement) {
        const start = picking.frontPoint(e);
        if (!start) return;
        e.preventDefault();
        e.stopPropagation();
        const original = current();
        drag = { index, pointer: e.pointerId, target, snapshot: model.snapshot(), start: { x: start.x, y: start.y }, original, last: original, moved: false, lockX: null, lockY: null, guides: [] };
        // Capture can fail if the pointer already ended; the drag still works from the handle's own events.
        try { target.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    }
    /** Browsers already deliver pointer moves aligned to frames, so each one is applied directly. */
    function moveHandleDrag(e: PointerEvent) {
        const g = drag;
        if (!g || e.pointerId !== g.pointer) return;
        const p = picking.frontPoint(e);
        if (!p) return;
        const o = g.original, point = o.top[g.index]!;
        const movesX = g.index > 0 && g.index < o.top.length - 1;
        // Targets follow the pointer from where the handle was grabbed.
        const rawY = point.y + p.y - g.start.y, rawX = point.x + p.x - g.start.x;
        const alignY = alignTo(rawY, heightTargets(o, g.index), g.lockY);
        const alignX = movesX ? alignTo(rawX, positionTargets(o, g.index), g.lockX) : null;
        g.lockY = alignY;
        g.lockX = alignX;
        g.guides = [
            ...(alignY ? [{ orient: 'h' as const, pos: alignY.v, label: alignY.label }] : []),
            ...(alignX ? [{ orient: 'v' as const, pos: alignX.v, label: alignX.label }] : []),
        ];
        const wantY = alignY ? alignY.v : roundCm(rawY);
        const wantX = movesX ? (alignX ? alignX.v : roundCm(rawX)) : point.x;
        const want = setPoint(o, g.index, { x: wantX, y: wantY });
        // Move as far toward the target as the rules allow, rather than stopping dead
        // at the first invalid position. Bisect between the last valid shape and the target.
        const valid = (t: number) => {
            const from = g.last.top[g.index]!;
            const at = setPoint(g.last, g.index, { x: from.x + (want.top[g.index]!.x - from.x) * t, y: from.y + (want.top[g.index]!.y - from.y) * t });
            return shapeProblems(at, state().w).length === 0 ? at : null;
        };
        let next = valid(1);
        if (!next) {
            let lo = 0, hi = 1, best = g.last;
            for (let n = 0; n < 14; n++) {
                const mid = (lo + hi) / 2, cand = valid(mid);
                if (cand) { lo = mid; best = cand; } else hi = mid;
            }
            next = best;
        }
        if (JSON.stringify(next.top) === JSON.stringify(g.last.top)) {
            // Only the guides changed (the point is held on a line): redraw them.
            callbacks.rebuild();
            return;
        }
        g.last = next;
        g.moved = true;
        if (sceneCommands.setShape(editable(next), false, false)) callbacks.rebuild();
    }
    function endHandleDrag(cancel = false) {
        if (!drag) return;
        const g = drag;
        drag = null;
        if (g.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer);
        const final = state().shape;
        model.restore(g.snapshot);
        if (!cancel && g.moved && final) sceneCommands.setShape(final);
        callbacks.histUI();
        callbacks.refresh();
    }
    /** Keyboard access for handles: arrows move by 1 cm, Shift by 0.5 cm. */
    function nudge(index: number, dx: number, dy: number) {
        const shape = current(), p = shape.top[index];
        if (!p) return;
        commit(setPoint(shape, index, { y: p.y + dy, ...(dx && index > 0 && index < shape.top.length - 1 ? { x: p.x + dx } : {}) }));
    }
    const dragging = () => drag !== null;
    return { render, bind, handles, splitMarkers, measures, guides, dragRulers, setScale, split, beginHandleDrag, moveHandleDrag, endHandleDrag, nudge, dragging, chooseTemplate };
}
