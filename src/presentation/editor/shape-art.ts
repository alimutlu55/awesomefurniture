import { SHAPE_TEMPLATES, createFromTemplate } from '../../domain/wardrobe/shape/shape-templates';
import { outerPolyline, partitionPositions, resolveShape, type ShapeTemplateId, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';

const NOMINAL = { w: 200, h: 230, maxN: 6 };

/** Front-elevation preview of a skeleton, drawn from the same resolved geometry
 * as the 3D model. `compact` draws the small chip used in the settings panel. */
export function shapeOutlineSvg(shape: WardrobeShape, size: { w: number; n: number; wt: readonly number[] }, compact = false): string {
    const resolved = resolveShape({ ...size, h: Math.max(...shape.top.map(p => p.y)), shape });
    const W = compact ? 44 : 146, H = compact ? 36 : 110, pad = compact ? 4 : 14, scale = Math.min((W - 2 * pad) / size.w, (H - 2 * pad) / Math.max(...resolved.top.map(p => p.y)));
    const ox = (W - size.w * scale) / 2 - (compact ? 0 : 6), floor = H - pad, X = (x: number) => (ox + x * scale).toFixed(1), Y = (y: number) => (floor - y * scale).toFixed(1);
    const outline = 'M' + X(0) + ' ' + Y(0) + ' ' + resolved.top.map(p => 'L' + X(p.x) + ' ' + Y(p.y)).join(' ') + ' L' + X(size.w) + ' ' + Y(0) + 'Z';
    const parts = partitionPositions({ ...size }).map(p => {
        const x = p + .9, top = Math.min(...outerPolyline(resolved, p, p + 1.8).map(q => q.y));
        return 'M' + X(x) + ' ' + Y(0) + 'V' + Y(Math.max(0, top - 2));
    }).join('');
    if (compact) {
        return '<svg class="shape-chip-art" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + outline + '" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="' + parts + '" stroke="currentColor" stroke-opacity=".55" stroke-width="1"/></svg>';
    }
    // Product-card style: a shallow side face suggests depth like the other fittings.
    const side = 'M' + X(size.w) + ' ' + Y(0) + ' l10 -6 V' + Y(resolved.top[resolved.top.length - 1]!.y + 4) + ' L' + X(size.w) + ' ' + Y(resolved.top[resolved.top.length - 1]!.y) + 'Z';
    return '<svg class="product-art shape-art" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + side + '" fill="#ad8a5e"/><path d="' + outline + '" fill="#d9bd91" stroke="#9c7b52" stroke-width="1.6" stroke-linejoin="round"/><path d="' + parts + '" stroke="#9c7b52" stroke-width="1.4"/></svg>';
}

export function templateArt(id: ShapeTemplateId, compact = false): string {
    const start = createFromTemplate(id, NOMINAL);
    return shapeOutlineSvg(start.shape, { w: NOMINAL.w, n: start.n, wt: start.wt }, compact);
}

export const shapeTemplates = () => SHAPE_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description }));
