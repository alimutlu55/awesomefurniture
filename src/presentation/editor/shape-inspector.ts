import type { createSceneCommands } from '../../application/commands/scene-commands';
import {
    addStep, MIN_SEGMENT, removePoint, resolveShape, setPanelAngle, setStepRise, shapePanels, splitPanel,
    type ShapeTemplateId, type WardrobeShape,
} from '../../domain/wardrobe/shape/wardrobe-shape';
import { shapeTemplates, templateArt } from './shape-art';
import { measureNumber, esc } from './editor-format.js';
import { createShapeHandleEditing, type ShapeHandlePorts } from './shape-handle-editing';
import { editProfilePoint, profileAt } from '../../domain/wardrobe/shape/shape-handle-edit';
import { createShapeSplitCursor } from './shape-split-cursor';

interface ShapeInspectorPorts {
    dom: {
        $<E extends HTMLElement = HTMLElement>(selector: string): E;
        document: { createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] };
    };
    model: ShapeHandlePorts['model'];
    sceneCommands: Pick<ReturnType<typeof createSceneCommands>, 'applyShapeTemplate' | 'setShape' | 'shapeEditProblem' | 'frontShape'>;
    picking: ShapeHandlePorts['picking'];
    selectionState: { shapeEditing?: boolean; focusOn: boolean };
    callbacks: { refresh(): void; rebuild(): void; histUI(): void; frame?(): void; report?(message: string): void };
}
/** Wardrobe-level skeleton editing: template choice, a precise panel list and
 * draggable break points on the model. Every change goes through scene commands,
 * which validate the geometry and refit fittings. */
export function createShapeInspector({ dom, model, sceneCommands, picking, selectionState, callbacks }: ShapeInspectorPorts) {
    const editing = createShapeHandleEditing({ model, sceneCommands, picking, callbacks });
    const state = () => model.activeCabinet().state;
    /** Editable skeleton; a regular wardrobe becomes a custom one once edited. */
    const current = (): WardrobeShape => resolveShape(state());
    const cursor = createShapeSplitCursor({ current: () => ({ id: model.activeCabinet().id, w: state().w, d: state().d, shape: current() }),
        point: (e, side) => { const p = picking.frontPoint(e, side); return p ? { x: p.x + state().w / 2, y: p.y } : null; },
        rebuild: callbacks.rebuild, insert: (index, x) => split(index, x) });
    const editable = (shape: WardrobeShape): WardrobeShape => state().shape ? shape : { ...shape, template: 'custom' };
    const f = (v: number) => measureNumber(Math.round(v * 10) / 10);
    /** Coordinates keep their sign and one decimal, unlike the clamped measure format. */
    const cm = (v: number) => String(Math.round(v * 10) / 10);
    /** Number inputs need a dot decimal, whatever the display locale. */
    const raw = (v: number) => String(Math.round(v * 10) / 10);

    const report = (message: string) => callbacks.report?.(message);
    function commit(next: WardrobeShape) {
        if (sceneCommands.setShape(editable(next))) callbacks.refresh();
        else render();
    }
    function chooseTemplate(id: ShapeTemplateId) {
        const active = state().shape?.template ?? 'regular';
        // Choosing the shape already in use just reopens its editing session.
        if (id === active && id !== 'custom') {
            selectionState.shapeEditing = true;
            callbacks.refresh();
            return;
        }
        if (sceneCommands.applyShapeTemplate(id)) {
            selectionState.shapeEditing = true;
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
        const current0 = shapeTemplates().find(t => t.id === active);
        dom.$('#shape-caption').textContent = current0 ? current0.name + ': ' + current0.description : '';
        templates.innerHTML = shapeTemplates().map(t => '<button type="button" class="shape-chip' + (t.id === active ? ' on' : '') + '" data-template="' + t.id + '" aria-pressed="' + (t.id === active) + '" title="' + esc(t.name + ' · ' + t.description) + '">' + templateArt(t.id, true) + '<span>' + esc(t.name) + '</span></button>').join('');
        fold.open = !!selectionState.shapeEditing;
        const shape = current(), pts = shape.top, rows: string[] = [], panelsList = shapePanels(shape);
        const point = (k: number, label: string, withX: boolean) => {
            rows.push(row('', k, label, '', withX ? action('remove', 'Remove ' + label.toLowerCase(), { p: k }, TRASH) : '', (withX ? field('From left', { p: k, k: 'x' }, pts[k]!.x, { min: 0, max: state().w }) : '') + field('Height', { p: k, k: 'y' }, pts[k]!.y, { min: 40, max: 280 }) + field('Rear height', { p: k, k: 'y', side: 'rear' }, shape.back?.[k] ?? pts[k]!.y, { min: 40, max: 280 })));
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
                rows.push(row('step', k, label, anchored ? 'On partition ' + (a.partition! + 1) : '', action('remove', 'Remove this step (both of its corners)', { p: k }, TRASH),
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
        if (input.dataset.k === 'angle') commit({ ...setPanelAngle(shape, Number(input.dataset.s), value), back: shape.back ?? shape.top.map(p => p.y) });
        else if (input.dataset.k === 'rise') commit({ ...setStepRise(shape, Number(input.dataset.p), value), back: shape.back ?? shape.top.map(p => p.y) });
        else commit(editProfilePoint(shape, input.dataset.side === 'rear' ? 'rear' : 'front', Number(input.dataset.p), input.dataset.k === 'x' ? { x: value } : { y: value }));
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
        // Focusing an angle field shows that panel's pivot and measurement.
        const setSegment = (segment: number | null) => {
            if (focusedSegment === segment) return;
            focusedSegment = segment;
            callbacks.rebuild();
        };
        listen(dom.$('#shape-panels'), 'focusin', e => {
            const input = e.target as HTMLInputElement;
            if (input.dataset?.k === 'angle') setSegment(Number(input.dataset.s));
        });
        listen(dom.$('#shape-panels'), 'focusout', () => setSegment(null));
        // Each chip previews what its shape is; the line stays with the current shape otherwise.
        const caption = (text: string) => { dom.$('#shape-caption').textContent = text; };
        listen(dom.$('#shape-templates'), 'pointerover', e => {
            const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-template]');
            const t = shapeTemplates().find(x => x.id === button?.dataset.template);
            if (t) caption(t.name + ': ' + t.description);
        });
        listen(dom.$('#shape-templates'), 'focusin', e => {
            const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-template]');
            const t = shapeTemplates().find(x => x.id === button?.dataset.template);
            if (t) caption(t.name + ': ' + t.description);
        });
        // Leaving a chip only restores the caption. The chips themselves must not be redrawn
        // here: a touch tap ends with pointerleave before its click, and a redrawn chip would
        // swallow that click.
        const restoreCaption = () => {
            const active = state().shape?.template ?? 'regular', t = shapeTemplates().find(x => x.id === active);
            caption(t ? t.name + ': ' + t.description : '');
        };
        listen(dom.$('#shape-templates'), 'pointerleave', restoreCaption);
        listen(dom.$('#shape-templates'), 'focusout', restoreCaption);
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
        return (['front', 'rear'] as const).flatMap(side => profileAt(shape, side).top.map((p, index) => ({
            index, side, x: p.x - w / 2, y: p.y, z: (side === 'rear' ? -1 : 1) * (state().d / 2 + 2),
            movesX: true, label: 'x ' + cm(p.x) + ' · y ' + cm(p.y),
        })));
    }
    /** One ruler for a panel or step, offset beside it. */
    function panelMeasure(shape: WardrobeShape, panel: ReturnType<typeof shapePanels>[number]) {
        const w = state().w, OFF = 8;
        if (panel.kind === 'top') {
            const a = shape.top[panel.from]!, b = shape.top[panel.to]!;
            return { a: { x: a.x - w / 2, y: a.y + OFF }, b: { x: b.x - w / 2, y: b.y + OFF }, text: f(panel.length) + ' cm · ' + Math.round(panel.angle) + '°', axis: 'width' as const };
        }
        if (panel.kind === 'step') {
            const a = shape.top[panel.from]!, b = shape.top[panel.to]!, rise = b.y - a.y, x = a.x - w / 2 + (rise > 0 ? -OFF : OFF);
            return { a: { x, y: Math.min(a.y, b.y) }, b: { x, y: Math.max(a.y, b.y) }, text: (rise > 0 ? '+' : '') + String(Math.round(rise * 10) / 10) + ' cm', axis: 'height' as const };
        }
        return null;
    }
    /** Resting measurements: every panel and step. */
    function measures() {
        const shape = current();
        return shapePanels(shape).map(p => panelMeasure(shape, p)).filter((m): m is NonNullable<typeof m> => m !== null);
    }
    /** Live measurements while a point is dragged: only the panels and steps that touch it,
     * so their length, angle or rise update as the point moves. */
    function dragMeasures() {
        const g = editing.drag();
        if (!g) return [];
        // The X and Y rulers already give the point's distances, so a touching panel
        // shows only its live angle. Steps keep their rise, which the rulers do not show.
        const profile = profileAt(g.last, g.side);
        return shapePanels(profile).filter(p => p.from === g.index || p.to === g.index).map(p => {
            const m = panelMeasure(profile, p);
            if (!m) return m;
            return p.kind === 'top' ? { ...m, text: Math.round(p.angle) + '°' } : m;
        }).filter((m): m is NonNullable<typeof m> => m !== null);
    }
    /** Why a drag stopped short of the pointer, in plain language. */
    function dragReason() {
        const g = editing.drag();
        if (!g || !g.reason) return null;
        const p = profileAt(g.last, g.side).top[g.index]!, w = state().w;
        return { text: g.reason, x: p.x - w / 2, y: p.y };
    }
    function split(index: number, position?: number) {
        const shape = current(), next = splitPanel(shape, index, position);
        if (next !== shape) commit(next);
        else report('This panel is too narrow to split. It needs at least ' + 2 * MIN_SEGMENT + ' cm.');
    }
    /** Keyboard focus on a break point or the angle field shows that point's or panel's measures. */
    let focusedSegment: number | null = null;
    function focusMeasures(phone: boolean) {
        if (focusedSegment !== null) {
            return measures().filter((_, i) => shapePanels(current())[i]?.from === focusedSegment);
        }
        return phone ? [] : measures();
    }
    function pivot() {
        if (focusedSegment === null) return null;
        const shape = current(), a = shape.top[focusedSegment];
        return a ? { x: a.x - state().w / 2, y: a.y } : null;
    }
    return { render, bind, handles, measures, dragMeasures, dragReason, focusMeasures, pivot, ...editing, ...cursor, split, chooseTemplate };
}
