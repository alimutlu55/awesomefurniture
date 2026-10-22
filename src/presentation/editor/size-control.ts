import { esc } from './editor-format.js';

const sliding = new WeakSet<HTMLInputElement>();
/** Keep the track stable for the entire gesture; its value always reflects the applied geometry. */
export function syncSizeRange(range: HTMLInputElement, min: string, max: string, value: string, disabled = false) {
  if (!sliding.has(range)) { range.min = min; range.max = max; }
  range.step = '0.1';
  range.value = value;
  range.disabled = disabled || Number(range.max) <= Number(range.min);
}

/** The app's numeric value and slider row. Domain-specific limits are supplied by the caller. */
export function sizeControlMarkup({ label, min, max, hint, hintKey, valueLabelId, inputAttributes = {}, rangeAttributes = {} }: {
  label: string; min: number; max: number; hint?: string | undefined; hintKey?: string; valueLabelId?: string;
  inputAttributes?: Record<string, string>; rangeAttributes?: Record<string, string>;
}) {
  const attrs = (values: Record<string, string>) => Object.entries(values).map(([key, value]) => ` ${key}="${esc(value)}"`).join('');
  const { inputmode = 'decimal', ...numberAttributes } = inputAttributes;
  const note = hint ? `<small class="room-field-hint"${hintKey ? ` data-room-hint="${esc(hintKey)}"` : ''}>${esc(hint)}</small>` : '';
  const value = valueLabelId ? `<b id="${esc(valueLabelId)}"></b>` : '';
  return `<div class="size-control resize-field-control"><label class="size-row"${inputAttributes.id ? ` for="${esc(inputAttributes.id)}"` : ''}>`
    + `<span>${esc(label)}${value}${note}</span><span class="size-field"><input type="number" inputmode="${esc(inputmode)}" min="${min}" max="${max}" step="0.1"`
    + `${attrs(numberAttributes)}><small>cm</small></span></label><input class="size-range" type="range" min="${min}" max="${max}" step="0.1"${attrs(rangeAttributes)}></div>`;
}

/** Shared preview/commit/cancel lifecycle: an entire slider gesture is one undo step. */
export function bindSizeSlider({ range, lifetime, model, history, preview, refresh, commit = () => {}, started = () => {}, finished = () => {} }: {
  range: HTMLInputElement; lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void };
  model: { snapshot(): string; restore(snapshot: string): void }; history: { checkpoint(snapshot: string): void };
  preview(value: number): void; refresh(): void; commit?(): void; started?(): void; finished?(): void;
}) {
  let before: string | null = null;
  const start = () => {
    if (before !== null) return;
    before = model.snapshot(); sliding.add(range); started();
  };
  const finish = (cancel = false) => {
    if (before === null) return;
    const original = before; before = null;
    if (cancel) model.restore(original); else commit();
    sliding.delete(range); finished();
    if (!cancel && model.snapshot() !== original) history.checkpoint(original);
    refresh();
  };
  lifetime.listen(range, 'pointerdown', start);
  lifetime.listen(range, 'input', () => {
    start();
    const value = range.valueAsNumber;
    // Every preview uses the same anchors and fittings. Changing direction or
    // returning to the start must not accumulate fitting or position changes.
    model.restore(before!); preview(value); refresh();
  });
  lifetime.listen(range, 'change', () => finish());
  lifetime.listen(range, 'pointerup', () => finish());
  lifetime.listen(range, 'blur', () => finish());
  lifetime.listen(range, 'pointercancel', () => finish(true));
  lifetime.listen(range, 'lostpointercapture', () => finish(true));
}

/** Numeric entry commits on change; Enter leaves the input and runs the same commit path. */
export function bindSizeNumber({ input, lifetime, commit, started = () => {}, finished = () => {} }: {
  input: HTMLInputElement; lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void };
  commit(value: number): void; started?(): void; finished?(): void;
}) {
  lifetime.listen(input, 'change', () => commit(input.valueAsNumber));
  lifetime.listen(input, 'focus', started); lifetime.listen(input, 'blur', finished);
  lifetime.listen(input, 'keydown', e => { if ((e as KeyboardEvent).key === 'Enter') input.blur(); });
}
