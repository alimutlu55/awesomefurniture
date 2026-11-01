import type { MakePiece } from '../../domain/make/make-parts';
import { fittingIcon } from './make-panel-tabs';

/** Lightweight chapter thumbnails projected from the real cut outlines. No second WebGL scene or animation. */
export function chapterPreview(piece: MakePiece, index: number): string {
  const step = piece.steps[index]!;
  if (!step.boards.length) return step.fittings.slice(0, 3).map(f => fittingIcon(f.kind)).join('');
  const project = (x: number, y: number, z: number) => [x * .86 - z * .65, -y + x * .22 + z * .32] as const;
  const faces: { points: readonly (readonly [number, number])[]; shade: string; order: number }[] = [];
  for (const id of step.boards) {
    const b = piece.boards[id]!;
    const outline = b.outline ?? [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
    const order = b.x0 + b.z1 - b.y0;
    faces.push({ points: outline.map(p => project(p.x, p.y, b.z1)), shade: '#b39472', order: order + .01 });
    outline.forEach((p, k) => {
      const next = outline[(k + 1) % outline.length]!;
      faces.push({ points: [project(p.x, p.y, b.z0), project(next.x, next.y, b.z0), project(next.x, next.y, b.z1), project(p.x, p.y, b.z1)],
        shade: p.y === next.y ? '#d1b799' : '#8b6f50', order });
    });
  }
  const points = faces.flatMap(f => f.points), xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs) - 8, y = Math.min(...ys) - 8, w = Math.max(...xs) - x + 8, h = Math.max(...ys) - y + 8;
  return `<svg class="as-geometry-preview" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true">`
    + faces.sort((a, b) => a.order - b.order).map(f => `<polygon points="${f.points.map(p => p.join(',')).join(' ')}" fill="${f.shade}" stroke="#735b41" stroke-width=".65"/>`).join('') + '</svg>';
}
