import type { BoundarySurface } from '../../domain/studio/studio-boundary';
import { surfaceSolid } from '../../domain/studio/studio-solid-boundary';
import type { Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';

/** One control per 2D profile point. Its 3D display position never creates independent depth edits. */
export function surfaceProfileHandles(room: Studio, kind: BoundarySurface, id: string): RoomHandle[] {
  const part = kind === 'wall' ? room.walls.find(w => w.id === id) : room.ceilings?.find(c => c.id === id);
  if (!part?.outline && !part?.sections) return [];
  const solid = surfaceSolid(room, kind, id);
  if (!solid) return [];
  const outer = solid.sections.at(-1)!;
  return outer.outline.flatMap((p, index) => {
    const explicit = solid.sections.find(s => (s.outline[index]!.control ?? -1) >= 0);
    const point = explicit?.outline[index] ?? p;
    if (point.control === -1) return [];
    const ceiling = kind === 'ceiling' ? room.ceilings!.find(c => c.id === id)! : undefined;
    const u = point.control ?? (ceiling?.run === 'across' ? .5 : 1);
    const section = solid.sections.findIndex(s => s.u === u);
    return [{ key: (kind === 'wall' ? 'wall-point:' : 'ceiling:') + id + ':' + index,
      kind: kind === 'wall' ? 'wall-point' as const : 'ceiling' as const, id, index,
      ...(part.sections ? { section: section < 0 ? solid.sections.length - 1 : section } : {}),
      ...solid.world({ ...point, u }), label: 'Point ' + (index + 1) + ', ' + point.y + ' high. Drag to reshape the profile',
    }];
  });
}
