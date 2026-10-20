import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { hasTrait } from '../wardrobe/fittings';
import { PANEL } from '../wardrobe/catalog.js';
import { drawerExtension } from '../wardrobe/drawer-runners';
import { isKitchen } from '../furniture/furniture';
import { type Item, type P, line } from './drawing';
import { piecefronts } from './fronts';
import { local } from './plan-symbols';
import { topAt } from './piece-front';
import type { PlacedPiece } from './room-pieces';

/** A quarter circle, sampled every 5 degrees; the same polyline reaches SVG and vector PDF. */
export function quarterArc(at: (s: number, t: number) => P, hinge: number, front: number, radius: number, sign: 1 | -1): P[] {
  return Array.from({ length: 19 }, (_, i) => {
    const a = i * Math.PI / 36;
    return at(hinge + sign * radius * Math.cos(a), front + radius * Math.sin(a));
  });
}

/** An opening's swept footprint in drawing millimetres, used for both drawing and clash checks. */
export interface Operation { readonly points: readonly P[]; readonly items: readonly Item[]; readonly bottom: number; readonly top: number }

export function pieceOperations(p: PlacedPiece): Operation[] {
  if (p.fixture) return [];
  const d = p.design, at = (s: number, t: number) => local(p, s - d.w / 2, t + d.d / 2);
  const out: Operation[] = [], seen = new Set<string>();
  let bottom = p.y, top = p.y + d.h, visible = true;
  const side = (x0: number, x1: number, hingeRight: boolean) => {
    const hinge = hingeRight ? x1 : x0, radius = x1 - x0;
    const arc = quarterArc(at, hinge, 0, radius, hingeRight ? -1 : 1), pivot = at(hinge, 0);
    out.push({ points: [pivot, ...arc], bottom, top,
      items: visible ? [line(pivot, arc.at(-1)!, 'swing'), { kind: 'line', stroke: 'swing', points: arc }] : [] });
  };
  const extend = (x0: number, x1: number, reach: number) => {
    if (reach <= 0) return;
    const points = [at(x0, 0), at(x1, 0), at(x1, reach), at(x0, reach)];
    out.push({ points, bottom, top, items: visible ? [{ kind: 'line', points, closed: true, stroke: 'swing' }] : [] });
  };
  for (const f of piecefronts(d).fronts) {
    const key = [f.opens, f.x0, f.x1, f.hinge, f.opens === 'down' ? f.y1 - f.y0 : ''].join(':');
    visible = !seen.has(key);
    seen.add(key);
    bottom = p.y + f.y0; top = p.y + Math.min(f.y1, Math.max(topAt(d, f.x0), topAt(d, f.x1)));
    if (f.opens === 'side') side(f.x0, f.x1, f.hinge === 'right');
    else if (f.opens === 'pull') extend(f.x0, f.x1, drawerExtension(d.d));
    else if (f.opens === 'down') extend(f.x0, f.x1, f.y1 - f.y0);
  }
  // Wardrobe pull-outs have no external kitchen front; their bay layout supplies their real width.
  if (!isKitchen(d)) {
    const geometry = createWardrobeGeometry(() => ({ ...d, sel: 0, item: -1, divider: -1, space: null }));
    let left = PANEL;
    geometry.widths().forEach((width, i) => {
      geometry.computeLayout(i).forEach((pos, j) => {
        if (!hasTrait(d.secs[i]![j]!.k, 'pullout')) return;
        const x0 = left + pos.off, x1 = x0 + pos.w, key = x0 + ':' + x1;
        if (seen.has(key)) return;
        seen.add(key);
        visible = true; bottom = p.y + pos.y0; top = p.y + pos.y1;
        extend(x0, x1, drawerExtension(d.d));
      });
      left += width + PANEL;
    });
  }
  return out;
}
