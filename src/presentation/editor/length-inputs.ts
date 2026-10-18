import { fromCm, lengthUnit, stepIn, toCm, type LengthUnit } from '../../domain/geometry/length-units';
import { currentLengthUnit, onLengthUnitChange } from './length-unit-state';

/** Number fields that hold a length keep working in centimetres for the rest of the editor: `value`, `valueAsNumber`,
 * `min`, `max` and `step` read and write centimetres, while the field itself shows and takes the unit the person
 * chose. That is the only place a field meets units, so panels, studio and shape fields need no change of their own.
 * A field is a length field when its label shows a unit next to it (`<small>cm</small>`). */
const ADOPTED = Symbol('lengthInput');
const NATIVE = Object.getOwnPropertyDescriptors(HTMLInputElement.prototype);
interface Adopted { show(unit: LengthUnit): void }
type Field = HTMLInputElement & { [ADOPTED]?: Adopted };

const unitLabel = (input: HTMLInputElement) => {
  const tag = input.parentElement?.querySelector<HTMLElement>('small');
  return tag && /^(cm|mm|in)$/.test(tag.textContent?.trim() ?? '') ? tag : null;
};
export const isLengthField = (input: HTMLInputElement) => input.type === 'number' && !!unitLabel(input);

/** Makes one field a length field. The text already in it is centimetres (it was just built by the panel). */
export function adoptLengthInput(input: HTMLInputElement): void {
  const field = input as Field;
  if (field[ADOPTED] || !isLengthField(input)) return;
  const read = (name: string) => NATIVE[name]!.get!.call(input) as string;
  const write = (name: string, value: string) => NATIVE[name]!.set!.call(input, value);
  let unit = currentLengthUnit(), cmStep = Number(input.step) || 0.5;
  let cmMin = input.min, cmMax = input.max;
  const shownIn = (u: LengthUnit, cm: string) => cm === '' || !Number.isFinite(Number(cm)) ? cm : String(fromCm(Number(cm), u, true));
  const apply = () => {
    write('min', shownIn(unit, cmMin)); write('max', shownIn(unit, cmMax)); write('step', stepIn(cmStep, unit));
    const tag = unitLabel(input); if (tag) tag.textContent = lengthUnit(unit).short;
  };
  const toCmText = (display: string) => display === '' || !Number.isFinite(Number(display)) ? display : String(toCm(Number(display), unit));
  Object.defineProperties(input, {
    value: { configurable: true, get: () => toCmText(read('value')), set: (cm: string) => write('value', shownIn(unit, String(cm))) },
    valueAsNumber: { configurable: true, get: () => { const n = NATIVE.valueAsNumber!.get!.call(input) as number; return Number.isNaN(n) ? n : toCm(n, unit); },
      set: (cm: number) => write('value', shownIn(unit, String(cm))) },
    min: { configurable: true, get: () => cmMin, set: (cm: string) => { cmMin = String(cm); apply(); } },
    max: { configurable: true, get: () => cmMax, set: (cm: string) => { cmMax = String(cm); apply(); } },
    step: { configurable: true, get: () => String(cmStep), set: (cm: string) => { cmStep = Number(cm) || cmStep; apply(); } },
  });
  // What the panel wrote before adoption is centimetres; show it in the chosen unit.
  const initial = read('value'); write('value', shownIn(unit, initial));
  field[ADOPTED] = { show(next) { const cm = toCmText(read('value')); unit = next; write('value', shownIn(unit, cm)); apply(); } };
  apply();
}

/** Adopts every length field under `root` now and as panels build more; follows the unit when it changes.
 * `register` ties the observer and subscription to the editor's lifetime. */
export function bindLengthInputs(root: ParentNode & Node, register: (undo: () => void) => void): void {
  const adopt = (scope: ParentNode) => scope.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach(adoptLengthInput);
  adopt(root);
  const observer = new MutationObserver(records => {
    for (const record of records) record.addedNodes.forEach(node => {
      if (node instanceof HTMLInputElement) adoptLengthInput(node); else if (node instanceof HTMLElement) adopt(node);
    });
  });
  observer.observe(root, { childList: true, subtree: true });
  register(() => observer.disconnect());
  register(onLengthUnitChange(unit => root.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach(input => (input as Field)[ADOPTED]?.show(unit))));
}
