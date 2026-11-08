import { backBoards } from '../make/back-construction';
import type { FaceWidth } from '../kitchen/corner-widths';
import { installationSlab } from '../kitchen/installation-parts';
import { kitchenFrontThickness } from '../kitchen/installation-parts';
import { defaultMaterials, resolveMaterials } from '../materials/configured-materials';
import { fitsStock } from '../make/stock-sheet';
import type { EditorDesign } from '../wardrobe/editor-design';
import { PANEL } from '../wardrobe/catalog.js';
import { BACK_PANEL, backFaceOf, besideInnerFrontDepth, fittingDepth, innerFront, partitionDepth, plinthOf } from '../wardrobe/carcass';
import { ceilingPieces, ceilingPolyline, resolveShape, shapeBoards } from '../wardrobe/shape/wardrobe-shape';
import { doorFit, doorTop, frontInside, leafThickness } from '../wardrobe/door-layout';
import { fitting, hasTrait, type FittingKind } from '../wardrobe/fittings';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { fittingPanels, sectionDividerBoards, sectionUprights } from '../geometry/shared-board-spans';
import { kitchenReveal, shelfHeights } from '../kitchen/kitchen-fronts';
import { kitchenUnit } from '../kitchen/kitchen-units';
import { isKitchen } from '../furniture/furniture';
import { innerFrontBehindDoor, piecefronts } from './fronts';
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
  /** Material removed from the stock envelope, in board/world-local coordinates. */
  readonly machining?: readonly { readonly outline: readonly P[]; readonly z0: number; readonly z1: number; readonly kind: 'rebate' | 'groove' }[];
  readonly edges: string;
  readonly note?: string | undefined;
  /** The fitting whose own front it is (a drawer front inside a wardrobe). */
  readonly kind?: FittingKind | undefined;
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

/** The centre lines of the partitions between bays, from the left face. */
function partitionLines(widths: readonly number[]): number[] {
  const lines: number[] = [];
  widths.slice(0, -1).reduce((x, sw) => { lines.push(x + sw + PANEL / 2); return x + sw + PANEL; }, PANEL);
  return lines;
}

/**
 * A board across the piece from `x0` to `x1` (`make` builds it): one board, or, when that is larger than a stock sheet
 * (D9), split over the partition nearest the middle of the span, and again, until each piece fits. The pieces meet on
 * the partition's centre line, so the partition carries the joint: it stands on the base's, under the top's and in
 * front of the back's, which is nailed or grooved into it as into the sides. A span with no partition left to split
 * over stays whole (the manufacturing check refuses it).
 */
function overPartitions(x0: number, x1: number, lines: readonly number[], decor: string, make: (x0: number, x1: number) => Board): Board[] {
  const whole = make(x0, x1), inside = lines.filter(x => x > x0 + .5 && x < x1 - .5);
  if (!inside.length || fitsStock(Math.round(whole.cut.length * 10), Math.round(whole.cut.width * 10), decor)) return [whole];
  const middle = (x0 + x1) / 2, at = inside.reduce((a, b) => Math.abs(b - middle) < Math.abs(a - middle) ? b : a);
  return [...overPartitions(x0, at, lines, decor, make), ...overPartitions(at, x1, lines, decor, make)];
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
  const sidesFrom = kitchen ? (kitchenUnit(design.unit).plinth ? plinthOf(design) : 0) : 0, part = partitionDepth(d), inside = frontInside(design), fit = fittingDepth(d, inside, backFaceOf(design));
  const editing = { ...design, sel: 0, item: -1, divider: -1, space: null }, geometry = createWardrobeGeometry(() => editing), widths = geometry.widths(), iy = lift + PANEL;
  const lines = partitionLines(widths), materials = resolveMaterials(design), carcass = materials.carcassDecorId;
  for (const b of shapeBoards(resolveShape(design))) {
    const sloped = Math.abs(b.points[0]!.y - b.points[1]!.y) > .05, run = Math.hypot(b.points[1]!.x - b.points[0]!.x, b.points[1]!.y - b.points[0]!.y);
    const x0 = Math.min(...b.points.map(p => p.x)), x1 = Math.max(...b.points.map(p => p.x)), y0 = Math.min(...b.points.map(p => p.y)), y1 = Math.max(...b.points.map(p => p.y));
    const name = b.kind === 'riser' ? 'Top riser' : 'Top';
    if (sloped) out.push({ ...board(name, 'carcass', { x0, x1, y0, y1, z0: 0, z1: d }, 'L1', 'x', { outline: b.points, note: 'sloped, ends cut to the angle' }),
      cut: { length: run, width: d, thickness: PANEL } });
    else if (b.kind === 'riser') out.push(board(name, 'carcass', { x0, x1, y0, y1, z0: 0, z1: d }, 'L1', 'x'));
    else out.push(...overPartitions(x0, x1, lines, carcass, (a, z) => board(name, 'carcass', { x0: a, x1: z, y0, y1, z0: 0, z1: d }, 'L1', 'x')));
  }
  out.push(upright('Side', 'carcass', design, 0, PANEL, sidesFrom, 0, d, 'L1'), upright('Side', 'carcass', design, w - PANEL, w, sidesFrom, 0, d, 'L1'));
  out.push(...overPartitions(PANEL, w - PANEL, lines, carcass, (x0, x1) => board('Base', 'carcass', { x0, x1, y0: lift, y1: lift + PANEL, z0: part.z0, z1: part.z1 }, 'L1', 'x')));
  out.push(...overPartitions(PANEL, w - PANEL, lines, materials.backingDecorId ?? carcass, (x0, x1) => upright('Back', 'back', design, x0, x1, lift, 0, BACK_PANEL, '—')));
  if (!kitchen && lift > 0) {
    // The plinth: a frame of a front and a back rail with a bearer between them at each end and under each joint of
    // rails split to fit the sheet, set back as the 3D plinth.
    const z0 = 2, z1 = d - 4, inner = { y0: 0, y1: lift };
    const front = overPartitions(PANEL, w - PANEL, lines, carcass, (x0, x1) => board('Plinth rail', 'plinth', { x0, x1, ...inner, z0: z1 - PANEL, z1 }, 'L1', 'x'));
    const rear = overPartitions(PANEL, w - PANEL, lines, carcass, (x0, x1) => board('Plinth rail', 'plinth', { x0, x1, ...inner, z0, z1: z0 + PANEL }, '—', 'x'));
    const bearer = (x0: number) => board('Plinth bearer', 'plinth', { x0, x1: x0 + PANEL, ...inner, z0: z0 + PANEL, z1: z1 - PANEL }, '—', 'z');
    out.push(...front, ...rear, bearer(PANEL), ...front.slice(1).map(r => bearer(r.x0 - PANEL / 2)), bearer(w - 2 * PANEL));
  }
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
      const rects = geometry.sectionDividers(i).map(q => ({ ...geometry.dividerRect(q), orientation: q.orientation })), shared = sectionDividerBoards(rects, iy);
      const panels = fittingPanels(lay.map((q, j) => ({ ...q, k: items[j]!.k })), iy, (x0, x1) => iy + geometry.ceilingTop(i, x0, x1), shared, sectionUprights(sw, rects, iy));
      panels.forEach((p, j) => {
        const it = items[j]!, pos = lay[j]!, front = fitting(it.k)?.innerFront ? innerFront(d, p.front.y0, p.front.y1 - p.front.y0, inside) : null;
        // The boards over and under a drawer stop behind its front (carcass.ts).
        const deck = front ? besideInnerFrontDepth(d, inside, backFaceOf(design)) : fit;
        for (const s of [...p.top, ...p.bottom]) out.push(board('Shelf', 'carcass', { x0: bayL + s.x0, x1: bayL + s.x1, y0: s.y0, y1: s.y1, z0: deck.z0, z1: deck.z1 }, 'L1', 'x'));
        // The side a drawer stack's runners are screwed to where it has no upright (shared-board-spans.ts).
        for (const s of p.side) out.push(board('Divider', 'carcass', { x0: bayL + s.x0, x1: bayL + s.x1, y0: s.y0, y1: s.y1, z0: deck.z0, z1: deck.z1 }, 'L1', 'y'));
        if (front) {
          const extent = { x0: bayL + pos.off + .2, x1: bayL + pos.off + pos.w - .2, y0: front.y0, y1: front.y1, z0: front.z0, z1: front.z1 };
          out.push(board('Drawer front', 'front', extent, 'L2 W2', 'y', { kind: it.k, ...(it.f ? { decorId: defaultMaterials(it.f).frontDecorId } : {}),
            ...(innerFrontBehindDoor(design, it) ? { note: 'finger grip' } : {}) }));
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
      const gap = f.installation ? 0 : kitchenReveal(design) / 2;
      out.push(board(f.name, 'front', { x0: f.x0 + gap, x1: f.x1 - gap, y0: f.y0 + gap, y1: f.y1 - gap, z0: d, z1: d + kitchenFrontThickness(design) }, 'L2 W2', 'y'));
      continue;
    }
    // A door leaf stops one reveal under the top (doorTop, as door-renderer.ts draws it); under a slope it is cut to it.
    const top = doorTop(design, f.x0, f.x1).map(p => ({ x: p.x, y: Math.min(p.y, f.y1) })), z = d + doorFit(design).standoff;
    const sloped = Math.max(...top.map(p => p.y)) - Math.min(...top.map(p => p.y)) > .05;
    // A leaf in its own decor (a glass or mirror leaf among wood ones) is cut from it, at its thickness.
    const t = leafThickness(design, f), own = f.decorId ? { decorId: f.decorId } : {};
    out.push(board('Door', 'door', { x0: f.x0, x1: f.x1, y0: f.y0, y1: Math.max(...top.map(p => p.y)), z0: z - t / 2, z1: z + t / 2 }, 'L2 W2', 'y',
      { ...own, ...(sloped ? { outline: [{ x: f.x0, y: f.y0 }, { x: f.x1, y: f.y0 }, ...top.slice().reverse()], note: 'top cut to the slope, see Front' } : {}) }));
  }
  return backBoards(out, design);
}
