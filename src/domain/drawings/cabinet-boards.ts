import type { FaceWidth } from '../kitchen/corner-widths';
import { installationSlab } from '../kitchen/installation-parts';
import { kitchenFrontThickness } from '../kitchen/installation-parts';
import { defaultMaterials } from '../materials/configured-materials';
import type { EditorDesign } from '../wardrobe/editor-design';
import { PANEL } from '../wardrobe/catalog.js';
import { BACK_PANEL, fittingDepth, partitionDepth, plinthOf } from '../wardrobe/carcass';
import { ceilingPieces, ceilingPolyline, outerPolyline, resolveShape, shapeBoards } from '../wardrobe/shape/wardrobe-shape';
import { DOOR, doorThickness } from '../wardrobe/door-layout';
import { fitting, hasTrait } from '../wardrobe/fittings';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { fittingPanels } from '../geometry/shared-board-spans';
import { FRONT_GAP, shelfHeights } from '../kitchen/kitchen-fronts';
import { kitchenUnit } from '../kitchen/kitchen-units';
import { isKitchen } from '../furniture/furniture';
import { piecefronts } from './fronts';
import type { P } from './drawing';

/** What a board is cut from. */
export type BoardStock = 'carcass' | 'back' | 'front' | 'door' | 'shelf' | 'plinth';
/** Kitchen shelves are 16 mm boards set 30 mm in from each side of the depth (furniture-parts.ts). Centimetres. */
const KITCHEN_SHELF = { thickness: 1.6, back: 2, front: 4, side: .5 } as const;

/**
 * One board of a cabinet as it is built, centimetres: across its width from the left face (`x`), up from its bottom
 * (`y`) and through its depth from the back (`z`). A board under a sloped top carries its front outline (`outline`);
 * otherwise it is the box `x0..x1 × y0..y1 × z0..z1`. `cut` is its cutting size, length along the grain first, and
 * `edges` its edge banding: how many long and short edges (L1 = one long edge, L2 W2 = all four).
 */
export interface Board {
  readonly name: string;
  readonly decorId?: string | undefined;
  readonly stock: BoardStock;
  readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly z0: number; readonly z1: number;
  readonly outline?: readonly P[] | undefined;
  readonly cut: { readonly length: number; readonly width: number; readonly thickness: number };
  readonly edges: string;
  readonly note?: string | undefined;
}

const span = (pts: readonly P[], axis: 'x' | 'y') => Math.max(...pts.map(p => p[axis])) - Math.min(...pts.map(p => p[axis]));
/** A board's cutting size from its extent: the thinnest way is its thickness; its length runs with the grain, across
 * the cabinet for a horizontal board (`x`), upright for a side, partition, back or front (`y`), front to back for a bearer (`z`). */
function board(name: string, stock: BoardStock, box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }, edges: string, grain: 'x' | 'y' | 'z', extra: Partial<Board> = {}): Board {
  const extent = { x: box.x1 - box.x0, y: box.y1 - box.y0, z: box.z1 - box.z0 }, thin = (Object.keys(extent) as ('x' | 'y' | 'z')[]).sort((a, b) => extent[a] - extent[b])[0]!;
  const along = grain === thin ? (grain === 'x' ? 'y' : 'x') : grain, across = (['x', 'y', 'z'] as const).find(k => k !== along && k !== thin)!;
  return { name, stock, ...box, cut: { length: extent[along], width: extent[across], thickness: extent[thin] }, edges, ...extra };
}

/** The outline of an upright board from `y0` up to the underside of the top over x0..x1 (shaped tops cut it to slope). */
function underTop(design: EditorDesign, x0: number, x1: number, y0: number): P[] {
  const pieces = ceilingPieces({ ...resolveShape(design), back: undefined });
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, ...ceilingPolyline(pieces, x0, x1).reverse()];
}
/** An upright under the top: its box, and its outline and a note when the top slopes over it. */
function upright(name: string, stock: BoardStock, design: EditorDesign, x0: number, x1: number, y0: number, z0: number, z1: number, edges: string) {
  const outline = underTop(design, x0, x1, y0), top = Math.max(...outline.map(p => p.y)), sloped = span(outline.slice(2), 'y') > .05;
  return board(name, stock, { x0, x1, y0, y1: top, z0, z1 }, edges, 'y', sloped ? { outline, note: 'cut to the top, see Inside' } : {});
}

/**
 * Every board of a piece as the 3D view builds it (frame-geometry.ts, fitting-renderer.ts, kitchen fronts): the top
 * boards over the sides, the sides standing under them, the base board between the sides from the back board's face
 * to the partition setback, the back between the sides, the plinth as a frame, the partitions, the boards of the
 * fittings and the shelves, the fronts or doors, and a wardrobe drawer's own front. A kitchen run's worktop and plinth
 * belong to the run, not to a unit.
 */
export function cabinetBoards(design: EditorDesign, faceWidths: readonly FaceWidth[] = []): Board[] {
  const slab = installationSlab(design);
  if (slab) return [slab];
  const shelfThickness = design.materials ? PANEL : KITCHEN_SHELF.thickness;
  const { w, d } = design, kitchen = isKitchen(design), lift = plinthOf(design), out: Board[] = [];
  const sidesFrom = kitchen ? (kitchenUnit(design.unit).plinth ? plinthOf(design) : 0) : 0, part = partitionDepth(d), fit = fittingDepth(d);
  for (const b of shapeBoards(resolveShape(design))) {
    const sloped = Math.abs(b.points[0]!.y - b.points[1]!.y) > .05, run = Math.hypot(b.points[1]!.x - b.points[0]!.x, b.points[1]!.y - b.points[0]!.y);
    const x0 = Math.min(...b.points.map(p => p.x)), x1 = Math.max(...b.points.map(p => p.x)), y0 = Math.min(...b.points.map(p => p.y)), y1 = Math.max(...b.points.map(p => p.y));
    const name = b.kind === 'riser' ? 'Top riser' : 'Top';
    out.push({ ...board(name, 'carcass', { x0, x1, y0, y1, z0: 0, z1: d }, 'L1', 'x', sloped ? { outline: b.points, note: 'sloped, ends cut to the angle' } : {}),
      ...(sloped ? { cut: { length: run, width: d, thickness: PANEL } } : {}) });
  }
  out.push(upright('Side', 'carcass', design, 0, PANEL, sidesFrom, 0, d, 'L1'), upright('Side', 'carcass', design, w - PANEL, w, sidesFrom, 0, d, 'L1'));
  out.push(board('Base', 'carcass', { x0: PANEL, x1: w - PANEL, y0: lift, y1: lift + PANEL, z0: part.z0, z1: part.z1 }, 'L1', 'x'));
  out.push(upright('Back', 'back', design, PANEL, w - PANEL, lift, 0, BACK_PANEL, '—'));
  if (!kitchen && lift > 0) {
    // The plinth: a frame of a front and a back rail with two bearers between them, set back as the 3D plinth.
    const z0 = 2, z1 = d - 4, inner = { y0: 0, y1: lift };
    out.push(board('Plinth rail', 'plinth', { x0: PANEL, x1: w - PANEL, ...inner, z0: z1 - PANEL, z1 }, 'L1', 'x'),
      board('Plinth rail', 'plinth', { x0: PANEL, x1: w - PANEL, ...inner, z0, z1: z0 + PANEL }, '—', 'x'),
      board('Plinth bearer', 'plinth', { x0: PANEL, x1: 2 * PANEL, ...inner, z0: z0 + PANEL, z1: z1 - PANEL }, '—', 'z'),
      board('Plinth bearer', 'plinth', { x0: w - 2 * PANEL, x1: w - PANEL, ...inner, z0: z0 + PANEL, z1: z1 - PANEL }, '—', 'z'));
  }
  const editing = { ...design, sel: 0, item: -1, divider: -1, space: null }, geometry = createWardrobeGeometry(() => editing), widths = geometry.widths(), iy = lift + PANEL;
  let bayL = PANEL;
  widths.forEach((sw, i) => {
    if (i < widths.length - 1) out.push(upright('Partition', 'carcass', design, bayL + sw, bayL + sw + PANEL, iy, part.z0, part.z1, 'L1'));
    const lay = geometry.computeLayout(i), items = design.secs[i] ?? [];
    if (kitchen) {
      lay.forEach((pos, j) => {
        const it = items[j]!;
        if (!hasTrait(it.k, 'appliance') && fitting(it.k)?.opens === 'side' && it.k !== 'corner') for (const y of shelfHeights(pos.y0, pos.y0 + it.h)) {
          out.push(board('Shelf', 'shelf', { x0: bayL + pos.off + KITCHEN_SHELF.side, x1: bayL + pos.off + pos.w - KITCHEN_SHELF.side, y0: y - shelfThickness / 2,
            y1: y + shelfThickness / 2, z0: KITCHEN_SHELF.back, z1: d - KITCHEN_SHELF.front }, 'L1', 'x', { note: 'adjustable' }));
        }
      });
    } else {
      const shared = geometry.sectionDividers(i).filter(q => q.orientation === 'horizontal').map(q => { const r = geometry.dividerRect(q); return { ...r, y0: r.y0 + iy, y1: r.y1 + iy }; });
      const panels = fittingPanels(lay.map((q, j) => ({ ...q, k: items[j]!.k })), iy, (x0, x1) => iy + geometry.ceilingTop(i, x0, x1), shared);
      panels.forEach((p, j) => {
        for (const s of [...p.top, ...p.bottom]) out.push(board('Shelf', 'carcass', { x0: bayL + s.x0, x1: bayL + s.x1, y0: s.y0, y1: s.y1, z0: fit.z0, z1: fit.z1 }, 'L1', 'x'));
        const it = items[j]!, pos = lay[j]!;
        if (fitting(it.k)?.innerFront) {
          const extent = { x0: bayL + pos.off + .2, x1: bayL + pos.off + pos.w - .2, y0: pos.y0, y1: pos.y0 + it.h - 1,
            z0: d - 1.2 - PANEL / 2, z1: d - 1.2 + PANEL / 2 };
          out.push(board('Drawer front', 'front', extent, 'L2 W2', 'y', it.f ? { decorId: defaultMaterials(it.f).frontDecorId } : {}));
        }
      });
      for (const q of geometry.sectionDividers(i)) {
        const r = geometry.visibleRect(q);
        out.push(board(q.orientation === 'horizontal' ? 'Shelf' : 'Divider', 'carcass', { x0: bayL + r.x0, x1: bayL + r.x1, y0: iy + r.y0, y1: iy + r.y1, z0: fit.z0, z1: fit.z1 }, 'L1', q.orientation === 'horizontal' ? 'x' : 'y'));
      }
    }
    bayL += sw + PANEL;
  });
  for (const f of piecefronts(design, faceWidths).fronts) {
    // An appliance's own front and an open shelf's opening are not cut.
    if (f.own || f.opens === 'open') continue;
    if (kitchen) {
      const gap = f.installation ? 0 : FRONT_GAP / 2;
      out.push(board(f.name, 'front', { x0: f.x0 + gap, x1: f.x1 - gap, y0: f.y0 + gap, y1: f.y1 - gap, z0: d, z1: d + kitchenFrontThickness(design) }, 'L2 W2', 'y'));
      continue;
    }
    // A door leaf stops DOOR.topGap under the outer top (door-renderer.ts); under a slope it is cut to it.
    const top = outerPolyline(resolveShape(design), f.x0, f.x1).map(p => Math.min(p.y - DOOR.topGap, f.y1)), z = d + DOOR.standoff;
    const sloped = Math.max(...top) - Math.min(...top) > .05;
    out.push(board('Door', 'door', { x0: f.x0, x1: f.x1, y0: f.y0, y1: Math.max(...top), z0: z - doorThickness(design) / 2, z1: z + doorThickness(design) / 2 }, 'L2 W2', 'y',
      sloped ? { note: 'top cut to the slope, see Front' } : {}));
  }
  return out;
}
