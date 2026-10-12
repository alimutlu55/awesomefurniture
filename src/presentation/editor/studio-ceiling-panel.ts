import { CEILING_SHAPES } from '../../domain/studio/studio-ceiling';
import type { CeilingShape } from '../../domain/studio/studio-ceiling';
import { esc } from './editor-format.js';

/** A ceiling shape drawn from its own `build`: the room seen from the side, the ceiling's solid shaded
 * down to its underside. A new entry in CEILING_SHAPES needs no drawing. */
export function ceilingArt(shape: CeilingShape, className = 'ceiling-art'): string {
  const W = 56, H = 40, top = 6, floor = 36, room = 260;
  const built = shape.build({ start: 0, end: 380, height: room, reach: 200 }), ps = built.profile;
  const span = built.run === 'along' ? { from: 0, to: 380 } : { from: 0, to: Math.max(...ps.map(p => p.t)) * 1.6 };
  const X = (t: number) => (4 + (t - span.from) / (span.to - span.from) * (W - 8)).toFixed(1), Y = (y: number) => (floor - y / room * (floor - top)).toFixed(1);
  const solid = `M${X(ps[0]!.t)} ${Y(room)}` + ps.map(p => `L${X(p.t)} ${Y(p.y)}`).join('') + `L${X(ps.at(-1)!.t)} ${Y(room)}Z`;
  return `<svg class="${className}" viewBox="0 0 ${W} ${H}" aria-hidden="true">`
    + `<path d="M4 ${top}H${W - 4}M4 ${floor}H${W - 4}" stroke="currentColor" stroke-width="1.2" fill="none" opacity=".45"/>`
    + `<path d="M4 ${top}V${floor}" stroke="currentColor" stroke-width="2.4" fill="none"/>`
    + `<path d="${solid}" fill="currentColor" fill-opacity=".32" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}

interface CeilingChoicesPorts {
  readonly document: { createElement: Document['createElement'] };
  readonly choose: (key: string) => void;
  readonly listen: (target: EventTarget, type: string, handler: (e: Event) => void) => void;
}

/** The toolbar's Ceiling choices for a selected wall (and Shape for a selected ceiling): each shape the
 * ceiling over this wall can take, drawn small with its name. Choosing one puts it on the wall. */
export function createCeilingChoices({ document, choose, listen }: CeilingChoicesPorts) {
  const root = document.createElement('div');
  root.className = 'ceiling-choices';
  root.innerHTML = (CEILING_SHAPES as readonly CeilingShape[]).map(s => `<button type="button" class="ceiling-choice" data-ceiling="${s.id}" title="${esc(s.description)}">${ceilingArt(s)}<span>${esc(s.name)}</span></button>`).join('');
  listen(root, 'click', e => {
    const button = (e.target as Element).closest<HTMLElement>('[data-ceiling]');
    if (button) choose('ceiling:' + button.dataset.ceiling);
  });
  return { root };
}
