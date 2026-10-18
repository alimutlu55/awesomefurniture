import { currentLengthUnit, unitSuffix, lengthText } from '../editor/length-unit-state';
import { fromCm, toCm, lengthUnit } from '../../domain/geometry/length-units';
/** Reusable measurement control. Features own values, validation and history;
 * this component owns pointer capture, keyboard access and exact number entry. */
export interface MeasurementBadgeBinding {
    id: string; selector: string; orientation: 'horizontal' | 'vertical';
    min?: number; max?: number; entry?: boolean;
    read(): number; begin(): void; preview(delta: number): number | null;
    finish(cancel: boolean): boolean; refresh(): void;
}
type EventSource = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
interface Lifetime {
    listen(target: EventSource, event: string, callback: (e: Event) => void, options?: boolean): void;
    frame(callback: () => void): unknown; cleanup(callback: () => void): void;
}
interface Feedback { begin(value: number): void; tick(value: number): void; settle(el: HTMLElement | null): void }
export function decorateMeasurementBadge(el: HTMLElement, options: {
    id: string; label: string; value: number; orientation: 'horizontal' | 'vertical'; min?: number; max?: number;
}) {
    el.classList.add('measurement-badge'); el.dataset.measurementBadge = options.id; el.tabIndex = 0;
    el.setAttribute('role', 'slider'); el.setAttribute('aria-label', options.label);
    el.setAttribute('aria-valuenow', String(options.value)); el.setAttribute('aria-valuetext', lengthText(options.value) + unitSuffix());
    el.setAttribute('aria-orientation', options.orientation);
    if (options.min !== undefined) el.setAttribute('aria-valuemin', String(options.min));
    if (options.max !== undefined) el.setAttribute('aria-valuemax', String(options.max));
    el.title = (options.orientation === 'vertical' ? 'Drag up/down' : 'Drag left/right') + '; tap to type; use arrow keys for precise changes';
}
export function bindMeasurementBadges({ layer, boundary, windowEvents, lifetime, resolve, feedback,
    active = () => {}, busy = () => false }: {
    layer: HTMLElement; boundary: HTMLElement; windowEvents: EventSource; lifetime: Lifetime;
    resolve(el: HTMLElement): MeasurementBadgeBinding | null; feedback: Feedback;
    active?(id: string | null): void; busy?(): boolean;
}) {
    type Drag = { binding: MeasurementBadgeBinding; pointer: number; x: number; y: number; delta: number; applied: number; moved: boolean };
    let drag: Drag | null = null, entry: { cancel(): void } | null = null, pendingEntry: MeasurementBadgeBinding | null = null;
    let queued = false, suppressClick = 0, drained: number | null = null, cancelledClick = false;
    const refresh = (b: MeasurementBadgeBinding, focused = false) => {
        b.refresh(); const el = layer.querySelector<HTMLElement>(b.selector);
        if (el) {
            const value = b.read(); el.setAttribute('role', 'slider');
            el.setAttribute('aria-valuenow', String(value)); el.setAttribute('aria-valuetext', lengthText(value) + unitSuffix());
            el.classList.toggle('is-scrubbing', !!drag);
        }
        if (focused) el?.focus({ preventScroll: true });
        return el;
    };
    const flush = () => {
        if (!drag || drag.applied === drag.delta) return;
        drag.applied = drag.delta;
        const value = drag.binding.preview(drag.delta);
        if (value !== null) feedback.tick(value);
        refresh(drag.binding);
    };
    function typeValue(b: MeasurementBadgeBinding) {
        if (entry) return;
        pendingEntry = null;
        const el = layer.querySelector<HTMLElement>(b.selector);
        if (!el) return;
        const initial = b.read(), input = el.ownerDocument.createElement('input');
        // The control owns centimetres; the field shows and reads the unit the person chose.
        const unit = currentLengthUnit(), shown = (cm: number) => String(fromCm(cm, unit, true));
        input.type = 'number'; input.inputMode = 'decimal'; input.step = unit === 'in' ? 'any' : unit === 'mm' ? '1' : '0.1'; input.value = shown(initial);
        if (b.min !== undefined) input.min = shown(b.min);
        if (b.max !== undefined) input.max = shown(b.max);
        input.setAttribute('aria-label', el.getAttribute('aria-label') ?? 'Measurement in ' + lengthUnit(unit).name.toLowerCase());
        b.begin(); feedback.begin(initial); active(b.id); el.classList.add('is-editing');
        el.removeAttribute('role'); el.replaceChildren(input);
        let done = false;
        const finish = (cancel = false) => {
            if (done) return; done = true; entry = null;
            const value = toCm(input.valueAsNumber, unit);
            if (!cancel && Number.isFinite(value)) { const actual = b.preview(value - initial); if (actual !== null) feedback.tick(actual); }
            const changed = b.finish(cancel || !Number.isFinite(value)); active(null);
            el.classList.remove('is-editing');
            const next = refresh(b, true); if (changed) feedback.settle(next);
        };
        entry = { cancel: () => finish(true) };
        input.onkeydown = e => {
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); finish(e.key === 'Escape'); }
        };
        input.onblur = () => finish(); input.focus({ preventScroll: true }); input.select();
    }
    function finish(cancel = false) {
        const g = drag;
        if (!g) return;
        if (!cancel) flush();
        drag = null; active(null); const changed = g.binding.finish(cancel);
        layer.querySelector(g.binding.selector)?.classList.remove('is-scrubbing');
        if (layer.hasPointerCapture(g.pointer)) layer.releasePointerCapture(g.pointer);
        // iOS only opens the software keyboard for focus within an eligible
        // user action. Wait for the native click rather than focusing on pointerup.
        pendingEntry = !cancel && !g.moved && g.binding.entry ? g.binding : null;
        // Keep the pressed badge attached so the browser can deliver that click.
        const next = pendingEntry ? layer.querySelector<HTMLElement>(g.binding.selector) : refresh(g.binding);
        if (changed) feedback.settle(next);
        drained = cancel ? g.pointer : null; cancelledClick = cancel;
        suppressClick = performance.now() + 350;
    }
    lifetime.listen(layer, 'pointerdown', raw => {
        const e = raw as PointerEvent, el = (e.target as HTMLElement).closest<HTMLElement>('[data-measurement-badge]');
        if (!el || (e.target as HTMLElement).matches('input') || e.button !== 0 || drag || entry || busy()) return;
        const b = resolve(el); if (!b) return;
        pendingEntry = null;
        // touch-action/user-select already prevent canvas panning and selection.
        // Cancelling pointerdown can suppress WebKit's keyboard-eligible click.
        e.stopImmediatePropagation(); b.begin(); feedback.begin(b.read()); active(b.id);
        drag = { binding: b, pointer: e.pointerId, x: e.clientX, y: e.clientY, delta: 0, applied: 0, moved: false };
        el.classList.add('is-scrubbing'); layer.setPointerCapture(e.pointerId);
    }, true);
    lifetime.listen(layer, 'pointermove', raw => {
        const e = raw as PointerEvent; if (!drag || drag.pointer !== e.pointerId) return;
        e.preventDefault(); e.stopImmediatePropagation();
        const pixels = drag.binding.orientation === 'vertical' ? drag.y - e.clientY : e.clientX - drag.x;
        if (!drag.moved && Math.abs(pixels) < 5) return;
        drag.moved = true; drag.delta = Math.round(pixels * (e.shiftKey ? .1 : .35));
        if (!queued) { queued = true; lifetime.frame(() => { queued = false; flush(); }); }
    }, true);
    lifetime.listen(layer, 'pointerup', raw => { if (drag?.pointer === (raw as PointerEvent).pointerId) { raw.stopImmediatePropagation(); finish(); } }, true);
    lifetime.listen(layer, 'pointercancel', () => { pendingEntry = null; finish(true); }, true);
    lifetime.listen(layer, 'lostpointercapture', () => finish(true), true);
    lifetime.listen(boundary, 'pointerdown', raw => {
        pendingEntry = null;
        if (!drag) drained = null;
        if (drag && drag.pointer !== (raw as PointerEvent).pointerId) { finish(true); raw.preventDefault(); raw.stopImmediatePropagation(); }
    }, true);
    lifetime.listen(boundary, 'pointerup', raw => {
        if (drained === (raw as PointerEvent).pointerId) { drained = null; raw.preventDefault(); raw.stopImmediatePropagation(); }
    }, true);
    lifetime.listen(boundary, 'click', raw => {
        if (cancelledClick && performance.now() < suppressClick) { raw.preventDefault(); raw.stopImmediatePropagation(); }
    }, true);
    lifetime.listen(layer, 'click', raw => {
        if ((raw.target as HTMLElement).matches('input') && entry) return;
        if (!pendingEntry && performance.now() >= suppressClick) return;
        // Capture may target the click at the label layer, not the badge.
        if (!pendingEntry && !(raw.target as HTMLElement).closest('[data-measurement-badge]')) return;
        raw.preventDefault(); raw.stopImmediatePropagation();
        const pending = pendingEntry; pendingEntry = null;
        if (pending) typeValue(pending);
    }, true);
    lifetime.listen(layer, 'keydown', raw => {
        const e = raw as KeyboardEvent, el = e.target as HTMLElement;
        if (el.matches('input') || drag || entry || busy()) return;
        const b = resolve(el); if (!b) return;
        if ((e.key === 'Enter' || e.key === ' ') && b.entry) { e.preventDefault(); e.stopImmediatePropagation(); typeValue(b); return; }
        if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault(); e.stopImmediatePropagation(); const value = b.read();
        const delta = e.key === 'Home' ? (b.min ?? value) - value : e.key === 'End' ? (b.max ?? value) - value
            : (e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1);
        b.begin(); feedback.begin(value); const actual = b.preview(delta), changed = b.finish(false);
        const next = refresh(b, true); if (changed) { if (actual !== null) feedback.tick(actual); feedback.settle(next); }
    }, true);
    const cancel = () => { pendingEntry = null; finish(true); entry?.cancel(); };
    lifetime.listen(windowEvents, 'keydown', raw => {
        const e = raw as KeyboardEvent;
        if (!entry && drag && (e.key === 'Escape' || e.ctrlKey || e.metaKey)) {
            cancel(); if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); }
        }
    }, true);
    lifetime.listen(windowEvents, 'blur', cancel); lifetime.cleanup(cancel);
}
