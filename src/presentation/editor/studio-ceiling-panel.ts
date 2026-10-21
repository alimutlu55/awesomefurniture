import type { CeilingShape } from '../../domain/studio/studio-ceiling';

/** A ceiling shape drawn from its own `build`: the room seen from the side, the ceiling's solid shaded
 * down to its underside. A new entry in CEILING_SHAPES needs no drawing. */
export function ceilingArt(shape: CeilingShape, className = 'product-art ceiling-product-art'): string {
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
