import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import type { Material, Object3D } from 'three';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { ceilingPieces, ceilingPolyline, resolveShape, shapeBoards } from '../../domain/wardrobe/shape/wardrobe-shape';
export type BoxBuilder = (w: number, h: number, d: number, x: number, y: number, z: number, material: Material, group?: Object3D) => Object3D;
export interface Point2 { x: number; y: number }
/** Extrudes a front-elevation polygon (cabinet-local x, floor-relative y) through
 * `depth`, centred on `z`. */
export type PrismBuilder = (points: readonly Point2[], depth: number, z: number, material: Material, group?: Object3D) => Object3D;

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
    const pieces = ceilingPieces(resolveShape(design)), top = ceilingPolyline(pieces, x0, x1);
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, ...top.reverse()].map(p => ({ x: p.x - design.w / 2, y: p.y }));
}

export function renderCabinetFrame(design: Pick<EditorDesign, 'w' | 'h' | 'd' | 'n' | 'wt' | 'shape'>, box: BoxBuilder, prism: PrismBuilder, materials: {
    panel: Material;
    back: Material;
    plinth: Material;
}): void {
    const { w, d } = design, panel = panelBuilder(box, prism), shape = resolveShape(design);
    for (const board of shapeBoards(shape)) {
        panel(board.points.map(p => ({ x: p.x - w / 2, y: p.y })), d, 0, materials.panel);
    }
    panel(boardUnderTop(design, 0, PANEL, 0), d, 0, materials.panel);
    panel(boardUnderTop(design, w - PANEL, w, 0), d, 0, materials.panel);
    box(w - 2 * PANEL, PANEL, d - 1, 0, PLINTH + PANEL / 2, 0, materials.panel);
    panel(boardUnderTop(design, PANEL, w - PANEL, PLINTH), .6, -d / 2 + .3, materials.back);
    box(w - 2 * PANEL, PLINTH, d - 6, 0, PLINTH / 2, -1, materials.plinth);
}
