import { wallFace, type Studio } from './studio';
import { wallAgainst, type PlacedBox } from './scene-gaps';

export interface WallItem {
  kind: 'opening' | 'fixture' | 'furniture'; id: string | number; wall: string;
  from: number; to: number; width: number; height: number; depth?: number;
}
export interface WallSegment { from: number; to: number; item?: WallItem; side?: 'left' | 'right' }

/** All wall attachments share one along-wall coordinate; furniture uses the existing standing-against rule. */
export function studioWallItems(studio: Studio, furniture: readonly PlacedBox[]): WallItem[] {
  return [
    ...studio.openings.map(o => ({ kind: 'opening' as const, id: o.id, wall: o.wall,
      from: o.offset - o.width / 2, to: o.offset + o.width / 2, width: o.width, height: o.height })),
    ...(studio.fixtures ?? []).map(f => ({ kind: 'fixture' as const, id: f.id, wall: f.wall,
      from: f.offset - f.width / 2, to: f.offset + f.width / 2, width: f.width, height: f.height, depth: f.depth })),
    ...furniture.flatMap(box => {
      const against = wallAgainst(box, studio);
      return against ? [{ kind: 'furniture' as const, id: box.id, wall: against.id,
        from: against.t - box.w / 2, to: against.t + box.w / 2, width: box.w, height: box.h, depth: box.d }] : [];
    }),
  ];
}

/** Clear stretches stop at the nearest item edge, irrespective of its kind. Overlapping projections have no gap. */
export function wallItemSegments(studio: Studio, wallId: string, items: readonly WallItem[], selected?: WallItem): WallSegment[] {
  const w = studio.walls.find(w => w.id === wallId), face = w && wallFace(studio, w);
  if (!face) return [];
  const onWall = items.filter(item => item.wall === wallId);
  if (selected) {
    const others = onWall.filter(item => item !== selected);
    const before = Math.max(face.start, ...others.filter(item => item.from <= selected.from).map(item => Math.min(selected.from, item.to)));
    const after = Math.min(face.end, ...others.filter(item => item.to >= selected.to).map(item => Math.max(selected.to, item.from)));
    const segments: WallSegment[] = [
      { from: before, to: selected.from, side: 'left' },
      { from: selected.from, to: selected.to, item: selected },
      { from: selected.to, to: after, side: 'right' },
    ];
    return segments.filter(s => s.to - s.from > .1);
  }
  if (!onWall.length) return [];
  const edges = [...new Set([face.start, ...onWall.flatMap(item => [item.from, item.to]), face.end])]
    .filter(t => t >= face.start && t <= face.end).sort((a, b) => a - b);
  return edges.slice(1).map((to, i) => {
    const from = edges[i]!, item = onWall.find(item => item.from <= (from + to) / 2 && item.to >= (from + to) / 2);
    return { from, to, ...(item ? { item } : {}) };
  });
}
