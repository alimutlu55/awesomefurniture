import { rearShape } from '../../domain/wardrobe/shape/depth-shape';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import type { Material, Object3D } from 'three';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { BACK_PANEL, partitionDepth } from '../../domain/wardrobe/carcass';
import { ceilingMin, ceilingPieces, ceilingPolyline, resolveShape, shapeBoards } from '../../domain/wardrobe/shape/wardrobe-shape';
export type BoxBuilder = (w: number, h: number, d: number, x: number, y: number, z: number, material: Material, group?: Object3D) => Object3D;
export interface Point2 { x: number; y: number }
/** Extrudes a front-elevation polygon (cabinet-local x, floor-relative y) through
 * `depth`, centred on `z`. */
export type PrismBuilder = (points: readonly Point2[], depth: number, z: number, material: Material, group?: Object3D, back?: readonly Point2[]) => Object3D;

/** Axis-aligned rectangles stay boxes so regular wardrobes render exactly as before;
 * any angled or notched outline becomes a prism. */
export function panelBuilder(box: BoxBuilder, prism: PrismBuilder) {
    return (points: readonly Point2[], depth: number, z: number, material: Material, group?: Object3D) => {
        const pts = dedupe(points), xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const rect = pts.length === 4 && pts.every(p => (Math.abs(p.x - x0) < 1e-6 || Math.abs(p.x - x1) < 1e-6) && (Math.abs(p.y - y0) < 1e-6 || Math.abs(p.y - y1) < 1e-6));
        return rect ? box(x1 - x0, y1 - y0, depth, (x0 + x1) / 2, (y0 + y1) / 2, z, material, group) : prism(pts, depth, z, material, group);
    };
}
export function dedupe(points: readonly Point2[]): Point2[] {
    const out: Point2[] = [];
    for (const p of points) {
        const q = out[out.length - 1];
        if (!q || Math.abs(q.x - p.x) > 1e-6 || Math.abs(q.y - p.y) > 1e-6) out.push({ x: p.x, y: p.y });
    }
    if (out.length > 2 && Math.abs(out[0]!.x - out[out.length - 1]!.x) < 1e-6 && Math.abs(out[0]!.y - out[out.length - 1]!.y) < 1e-6) out.pop();
    return out;
}

/** Front-elevation outline of a vertical board from `y0` up to the underside of
 * the top, over cabinet-width coordinates [x0, x1] (left outer face = 0). */
export function boardUnderTop(design: Pick<EditorDesign, 'w' | 'h' | 'n' | 'wt' | 'shape'>, x0: number, x1: number, y0: number): Point2[] {
    const shape = resolveShape(design), pieces = ceilingPieces({ ...shape, back: undefined }), top = ceilingPolyline(pieces, x0, x1);
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, ...top.reverse()].map(p => ({ x: p.x - design.w / 2, y: p.y }));
}

/** `sidesFrom`: where the sides start (a kitchen unit's sides stand on the run's plinth); `plinth`: whether the
 * cabinet draws its own plinth (a kitchen run draws one along all its units). Wardrobes use the defaults. */
export function renderCabinetFrame(design: Pick<EditorDesign, 'w' | 'h' | 'd' | 'n' | 'wt' | 'shape'>, box: BoxBuilder, prism: PrismBuilder, materials: {
    panel: Material;
    back: Material;
    plinth: Material;
}, { sidesFrom = 0, plinth = true, solidBottom = false }: { sidesFrom?: number; plinth?: boolean; solidBottom?: boolean } = {}): void {
    const { w, d } = design, panel = panelBuilder(box, prism), shape = resolveShape(design);
    const back = rearShape(shape), tops = shapeBoards(shape), rearTops = shapeBoards(back);
    tops.forEach((board, i) => {
        const points = board.points.map(p => ({ x: p.x - w / 2, y: p.y }));
        if (shape.back) prism(points, d, 0, materials.panel, undefined, rearTops[i]!.points.map(p => ({ x: p.x - w / 2, y: p.y })));
        else panel(points, d, 0, materials.panel);
    });
    renderUpright(design, 0, PANEL, sidesFrom, d, materials.panel, box, prism);
    renderUpright(design, w - PANEL, w, sidesFrom, d, materials.panel, box, prism);
    // The base board stops at the back board's face; the back sits between the sides (carcass.ts).
    const base = partitionDepth(d);
    box(w - 2 * PANEL, PANEL, base.depth, 0, PLINTH + PANEL / 2, base.centre, materials.panel);
    // A unit whose sides run to the floor line without a plinth (a wall unit) has a solid bottom down to its lower edge.
    if (solidBottom) box(w - 2 * PANEL, PLINTH, base.depth, 0, PLINTH / 2, base.centre, materials.panel);
    panel(boardUnderTop({ ...design, shape: back }, PANEL, w - PANEL, PLINTH), BACK_PANEL, -d / 2 + BACK_PANEL / 2, materials.back);
    if (plinth) box(w - 2 * PANEL, PLINTH, d - 6, 0, PLINTH / 2, -1, materials.plinth);
}

/** Side panels and partitions join the independently edited front and rear. */
export function renderUpright(design: Pick<EditorDesign, 'w' | 'h' | 'd' | 'n' | 'wt' | 'shape'>,
    x0: number, x1: number, y0: number, depth: number, material: Material, box: BoxBuilder, prism: PrismBuilder, z = 0) {
    const shape = resolveShape(design), points = boardUnderTop(design, x0, x1, y0);
    if (!shape.back) return panelBuilder(box, prism)(points, depth, z, material);
    const pieces = ceilingPieces(rearShape(shape));
    const back = points.map((p, i) => i < 2 ? p : { x: p.x, y: ceilingMin(pieces, p.x + design.w / 2, p.x + design.w / 2) });
    return prism(points, depth, z, material, undefined, back);
}
