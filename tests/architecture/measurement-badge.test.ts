import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindMeasurementBadges, decorateMeasurementBadge } from '../../src/presentation/components/measurement-badge';

function fixture() {
    const listeners = new Map<object, Map<string, (e: Event) => void>>(), cleanups: (() => void)[] = [], frames: (() => void)[] = [];
    const attrs = new Map<string, string>(), classes = new Set<string>();
    let input: any, capture = false, value = 100, origin = 100, commits = 0, ticks = 0, springs = 0, focused = 0, refreshes = 0;
    const el: any = { dataset: {}, classList: { add: (s: string) => classes.add(s), remove: (s: string) => classes.delete(s), toggle: (s: string, on: boolean) => on ? classes.add(s) : classes.delete(s) },
        setAttribute: (k: string, v: string) => attrs.set(k, v), getAttribute: (k: string) => attrs.get(k), removeAttribute: (k: string) => attrs.delete(k),
        closest: () => el, matches: () => false, focus: () => focused++, replaceChildren: (child: any) => { input = child; },
        ownerDocument: { createElement: () => ({ setAttribute() {}, focus() {}, select() {}, get valueAsNumber() { return Number(this.value); }, value: '' }) } };
    const layer: any = { querySelector: () => el, setPointerCapture: () => { capture = true; },
        hasPointerCapture: () => capture, releasePointerCapture: () => { capture = false; } };
    const boundary = {} as HTMLElement, windowEvents = {} as EventTarget;
    decorateMeasurementBadge(el, { id: 'test', label: 'Example width', value, orientation: 'horizontal', min: 50, max: 150 });
    bindMeasurementBadges({ layer, boundary, windowEvents,
        lifetime: { listen(target, name, fn) { if (!listeners.has(target)) listeners.set(target, new Map()); listeners.get(target)!.set(name, fn); },
            frame(fn) { frames.push(fn); }, cleanup(fn) { cleanups.push(fn); } },
        feedback: { begin() {}, tick() { ticks++; }, settle() { springs++; } },
        resolve: () => ({ id: 'test', selector: '[data-measurement-badge]', orientation: 'horizontal', min: 50, max: 150, entry: true,
            read: () => value, begin: () => { origin = value; }, preview: delta => value = Math.min(150, Math.max(50, origin + delta)),
            finish: cancel => { if (cancel) value = origin; else if (value !== origin) { commits++; return true; } return false; },
            refresh: () => { refreshes++; el.textContent = String(value); } }),
    });
    const event = (extra = {}) => ({ target: el, button: 0, pointerId: 1, clientX: 0, clientY: 0,
        preventDefault() {}, stopImmediatePropagation() {}, stopPropagation() {}, ...extra } as unknown as Event);
    return { el, attrs, classes, layer, boundary, windowEvents,
        fire(target: object, name: string, extra = {}) { listeners.get(target)!.get(name)!(event(extra)); },
        flush() { frames.splice(0).forEach(fn => fn()); }, dispose() { cleanups.forEach(fn => fn()); }, input: () => input,
        state: () => ({ value, commits, ticks, springs, focused, refreshes }) };
}
test('the reusable badge decorates semantics and coalesces pointer updates into one commit', () => {
    const f = fixture(); assert.equal(f.attrs.get('role'), 'slider'); assert.equal(f.attrs.get('aria-label'), 'Example width');
    f.fire(f.layer, 'pointerdown'); f.fire(f.layer, 'pointermove', { clientX: 20 }); f.fire(f.layer, 'pointermove', { clientX: 40 });
    assert.equal(f.state().value, 100); f.flush(); assert.equal(f.state().value, 114);
    f.fire(f.layer, 'pointerup'); assert.equal(f.state().commits, 1); assert.equal(f.state().springs, 1);
    f.fire(f.layer, 'click'); assert.equal(f.input(), undefined, 'a completed drag never opens the keyboard');
    assert.equal(f.classes.has('is-scrubbing'), false);
});
test('pointer cancellation, a second contact, blur and disposal restore previews without history', () => {
    for (const reason of ['pointercancel', 'second', 'blur', 'dispose', 'escape']) {
        const f = fixture(); f.fire(f.layer, 'pointerdown'); f.fire(f.layer, 'pointermove', { clientX: 40 }); f.flush();
        if (reason === 'second') f.fire(f.boundary, 'pointerdown', { pointerId: 2 });
        else if (reason === 'blur') f.fire(f.windowEvents, 'blur');
        else if (reason === 'dispose') f.dispose();
        else if (reason === 'escape') f.fire(f.windowEvents, 'keydown', { key: 'Escape' });
        else f.fire(f.layer, reason);
        assert.equal(f.state().value, 100, reason); assert.equal(f.state().commits, 0); assert.equal(f.state().springs, 0);
    }
});
test('keyboard steps and limits use the same validation; blocked values never bounce', () => {
    const f = fixture(); f.fire(f.layer, 'keydown', { key: 'ArrowRight', shiftKey: true }); assert.equal(f.state().value, 105);
    f.fire(f.layer, 'keydown', { key: 'End' }); assert.equal(f.state().value, 150);
    f.fire(f.layer, 'keydown', { key: 'ArrowRight' }); assert.equal(f.state().commits, 2); assert.equal(f.state().springs, 2);
});
test('tap and keyboard open exact entry; Enter commits once and Escape cancels', () => {
    const f = fixture(); f.fire(f.layer, 'pointerdown'); f.fire(f.layer, 'pointerup');
    assert.equal(f.input(), undefined, 'wait for the keyboard-eligible click');
    assert.equal(f.state().refreshes, 0, 'keep the pressed badge attached until click');
    f.fire(f.layer, 'click');
    f.input().value = '123.4'; f.input().onkeydown({ key: 'Enter', preventDefault() {}, stopPropagation() {} });
    f.input().onblur(); assert.equal(f.state().value, 123.4); assert.equal(f.state().commits, 1);
    assert.equal(f.classes.has('is-editing'), false); assert.equal(f.attrs.get('role'), 'slider');
    f.fire(f.layer, 'keydown', { key: 'Enter' }); f.input().value = '140';
    f.input().onkeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); assert.equal(f.state().value, 123.4);
    assert.equal(f.state().commits, 1);
});
test('Escape drains the outstanding pointer release and click so cancellation cannot deselect the edited part', () => {
    const f = fixture(); let stopped = 0;
    f.fire(f.layer, 'pointerdown'); f.fire(f.layer, 'pointermove', { clientX: 40 }); f.flush();
    f.fire(f.windowEvents, 'keydown', { key: 'Escape' });
    f.fire(f.boundary, 'pointerup', { stopImmediatePropagation() { stopped++; } });
    f.fire(f.boundary, 'click', { stopImmediatePropagation() { stopped++; } });
    assert.equal(stopped, 2); assert.equal(f.state().value, 100); assert.equal(f.state().commits, 0);
});
test('a captured tap opens on the native layer click and preserves editing on subsequent input taps', () => {
    const f = fixture(); let prevented = 0;
    f.fire(f.layer, 'pointerdown'); f.fire(f.layer, 'pointerup'); f.fire(f.layer, 'lostpointercapture');
    assert.equal(f.input(), undefined);
    f.fire(f.layer, 'click', { target: { closest: () => null, matches: () => false }, preventDefault() { prevented++; } });
    const input = f.input(); assert.ok(input); assert.equal(prevented, 1);
    f.fire(f.layer, 'click', { target: { closest: () => f.el, matches: () => true } });
    assert.equal(f.input(), input);
    input.value = '115'; input.onkeydown({ key: 'Enter', preventDefault() {}, stopPropagation() {} });
    assert.equal(f.state().value, 115); assert.equal(f.state().commits, 1);
});
