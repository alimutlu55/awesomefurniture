import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { hasTrait } from '../wardrobe/fittings';
import { PANEL } from '../wardrobe/catalog.js';
import { drawerExtension } from '../wardrobe/drawer-runners';
import { isKitchen } from '../furniture/furniture';
import { type Item, type P, line } from './drawing';
import { piecefronts, type Front } from './fronts';
import { hinge, hingeFor } from '../wardrobe/hinges';
import { getDecor } from '../materials/decor-catalog';
import { resolveMaterials } from '../materials/configured-materials';
import { local } from './plan-symbols';
import { topAt } from './piece-front';
import type { PlacedPiece } from './room-pieces';
import { cornerFaceWidths } from './corner-widths';

/** An arc from the closed position to `degrees` open, sampled every 5 degrees (and at its end); the same polyline reaches
 * SVG and vector PDF. Past 90 degrees it swings back behind the hinge. */
export function swingArc(at: (s: number, t: number) => P, hinge: number, front: number, radius: number, sign: 1 | -1, degrees: number): P[] {
  const steps = [...Array.from({ length: Math.floor(degrees / 5) + 1 }, (_, i) => i * 5), ...(degrees % 5 ? [degrees] : [])];
  return steps.map(deg => {
    const a = deg * Math.PI / 180;
    return at(hinge + sign * radius * Math.cos(a), front + radius * Math.sin(a));
  });
}
/** A quarter circle (a room door's swing). */
export const quarterArc = (at: (s: number, t: number) => P, hinge: number, front: number, radius: number, sign: 1 | -1) => swingArc(at, hinge, front, radius, sign, 90);

/** A hinged front's swing in plan: from its hinge edge, as far as its hinge opens (hingeFor), in drawing millimetres. */
export function leafSwing(p: PlacedPiece, f: Front) {
  const d = p.design, at = (s: number, t: number) => local(p, s - d.w / 2, t + d.d / 2), right = f.hinge === 'right', hingeX = right ? f.x1 : f.x0;
  // An appliance's door opens on the appliance's own hinges: drawn square.
  const glass = f.glass ?? getDecor(resolveMaterials(d).frontDecorId).category === 'glass_mirror', angle = f.label ? 90 : hinge(hingeFor(f, d, glass, p.sides)).angle;
  const arc = swingArc(at, hingeX, 0, f.x1 - f.x0, right ? -1 : 1, angle), pivot = at(hingeX, 0);
  return { pivot, arc, angle, points: [pivot, ...arc] as readonly P[] };
}

/** An opening's swept footprint in drawing millimetres, used for both drawing and clash checks. */
export interface Operation { readonly points: readonly P[]; readonly items: readonly Item[]; readonly bottom: number; readonly top: number }

export function pieceOperations(p: PlacedPiece, pieces: readonly PlacedPiece[] = [p]): Operation[] {
  if (p.fixture) return [];
  const d = p.design, at = (s: number, t: number) => local(p, s - d.w / 2, t + d.d / 2);
  const out: Operation[] = [], seen = new Set<string>();
  let bottom = p.y, top = p.y + d.h, visible = true;
  // A hinged front swings as far as its hinge opens: past square for a 110° hinge, back flat for a 170° one.
  const side = (f: Front) => {
    const { pivot, arc, points } = leafSwing(p, f);
    out.push({ points, bottom, top, items: visible ? [line(pivot, arc.at(-1)!, 'swing'), { kind: 'line', stroke: 'swing', points: arc }] : [] });
  };
  const extend = (x0: number, x1: number, reach: number) => {
    if (reach <= 0) return;
    const points = [at(x0, 0), at(x1, 0), at(x1, reach), at(x0, reach)];
    out.push({ points, bottom, top, items: visible ? [{ kind: 'line', points, closed: true, stroke: 'swing' }] : [] });
  };
  for (const f of piecefronts(d, cornerFaceWidths(p, pieces)).fronts) {
    const key = [f.opens, f.x0, f.x1, f.hinge, f.opens === 'down' ? f.y1 - f.y0 : ''].join(':');
    visible = !seen.has(key);
    seen.add(key);
    bottom = p.y + f.y0; top = p.y + Math.min(f.y1, Math.max(topAt(d, f.x0), topAt(d, f.x1)));
    if (f.opens === 'side') side(f);
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
