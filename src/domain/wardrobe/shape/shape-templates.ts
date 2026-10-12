import { PANEL } from '../catalog.js';
import { MIN_OUTER_HEIGHT, partitionPositions, shapeProblems, type ShapePoint, type ShapeTemplateId, type WardrobeShape } from './wardrobe-shape';

/** A template is only a starting skeleton in the shared shape model. Adding a
 * template means adding one entry here; geometry and rendering need no changes. */
export interface ShapeTemplate {
  id: ShapeTemplateId;
  name: string;
  description: string;
  /** Proposed starting sections. Weights are relative, as in the editor design. */
  create(size: { w: number; h: number; maxN: number }): { shape: WardrobeShape; n: number; wt: number[] };
}

const r = (v: number) => Math.round(v * 10) / 10;
const fill = (wt: number[]) => wt.concat([100, 100, 100, 100, 100, 100]).slice(0, 6);
/** Weights that put partition k's left face at the given x positions. */
export function weightsFor(w: number, cuts: number[]): number[] {
  const edges = [PANEL, ...cuts.flatMap(x => [x, x + PANEL]), w - PANEL], wt: number[] = [];
  for (let i = 0; i < edges.length; i += 2) wt.push(r(edges[i + 1]! - edges[i]!));
  return wt;
}

export const SHAPE_TEMPLATES: readonly ShapeTemplate[] = [
  {
    id: 'regular', name: 'Regular', description: 'Rectangular wardrobe',
    create: ({ w, h }) => ({ shape: { template: 'regular', top: [{ x: 0, y: h }, { x: w, y: h }] }, n: 1, wt: fill([100]) }),
  },
  {
    id: 'sloped', name: 'Sloped', description: 'Angled top for sloping ceilings',
    create: ({ w, h, maxN }) => {
      const low = Math.max(MIN_OUTER_HEIGHT + 60, r(h - Math.min(90, w * .45)));
      const n = Math.min(2, maxN);
      return { shape: { template: 'sloped', top: [{ x: 0, y: low }, { x: w, y: h }] }, n, wt: fill(Array(n).fill(100)) };
    },
  },
  {
    id: 'stepped', name: 'Stepped', description: 'Different heights per section',
    create: ({ w, h, maxN }) => {
      const n = Math.min(3, maxN), parts = partitionPositions({ w, n, wt: Array(n).fill(100) }), drop = Math.min(40, (h - MIN_OUTER_HEIGHT - 60) / Math.max(1, n - 1));
      const top: ShapePoint[] = [{ x: 0, y: h }];
      parts.forEach((p, k) => {
        const y0 = r(h - drop * k), y1 = r(h - drop * (k + 1));
        top.push({ x: p + PANEL, y: y0, partition: k }, { x: p + PANEL, y: y1, partition: k });
      });
      top.push({ x: w, y: r(h - drop * (n - 1)) });
      return { shape: { template: 'stepped', top }, n, wt: fill(Array(n).fill(100)) };
    },
  },
  {
    id: 'under-stairs', name: 'Under-stairs', description: 'Follows a staircase above',
    create: ({ w, h, maxN }) => {
      const n = Math.min(3, maxN), low = Math.max(MIN_OUTER_HEIGHT + 20, r(h * .3)), peak = r(w * .72);
      return { shape: { template: 'under-stairs', top: [{ x: 0, y: low }, { x: peak, y: h }, { x: w, y: h }] }, n, wt: fill(Array(n).fill(100)) };
    },
  },
  {
    id: 'alcove', name: 'Recessed', description: 'Fits around a beam or boxing',
    create: ({ w, h, maxN }) => {
      if (maxN < 2) return { shape: { template: 'alcove', top: [{ x: 0, y: h }, { x: w, y: h }] }, n: 1, wt: fill([100]) };
      const box = Math.min(60, r(w * .3)), cut = r(w - box - PANEL), drop = Math.min(40, h - MIN_OUTER_HEIGHT - 60);
      return {
        shape: { template: 'alcove', top: [{ x: 0, y: h }, { x: cut + PANEL, y: h, partition: 0 }, { x: cut + PANEL, y: r(h - drop), partition: 0 }, { x: w, y: r(h - drop) }] },
        n: 2, wt: fill(weightsFor(w, [cut])),
      };
    },
  },
  {
    id: 'custom', name: 'Custom', description: 'Free-form top to shape yourself',
    create: ({ w, h, maxN }) => {
      const n = Math.min(2, maxN);
      return { shape: { template: 'custom', top: [{ x: 0, y: h }, { x: r(w / 3), y: h }, { x: r(w * 2 / 3), y: h }, { x: w, y: h }] }, n, wt: fill(Array(n).fill(100)) };
    },
  },
];

export function shapeTemplate(id: ShapeTemplateId): ShapeTemplate {
  const found = SHAPE_TEMPLATES.find(t => t.id === id);
  if (!found) throw new Error('Unknown wardrobe shape: ' + id);
  return found;
}

/** A template's starting skeleton, guaranteed valid for this size or regular. */
export function createFromTemplate(id: ShapeTemplateId, size: { w: number; h: number; maxN: number }) {
  const result = shapeTemplate(id).create(size);
  return shapeProblems(result.shape, size.w).length ? { ...SHAPE_TEMPLATES[0]!.create(size), shape: { template: id, top: [{ x: 0, y: size.h }, { x: size.w, y: size.h }] } } : result;
}
