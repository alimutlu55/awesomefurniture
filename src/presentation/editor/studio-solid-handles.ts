import type { BoundarySurface } from '../../domain/studio/studio-boundary';
import { surfaceSolid } from '../../domain/studio/studio-solid-boundary';
import type { Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';

/** Inner rims and newly cut depth rings use the same editing controls as the outer rim. */
export function innerSurfaceHandles(room: Studio, kind: BoundarySurface, id: string): RoomHandle[] {
  const solid = surfaceSolid(room, kind, id);
  if (!solid) return [];
  return solid.sections.slice(0, -1).flatMap((s, section) => s.outline.map((p, index) => ({
    key: (kind === 'wall' ? 'wall-point:' : 'ceiling:') + id + ':section:' + section + ':' + index,
    kind: kind === 'wall' ? 'wall-point' as const : 'ceiling' as const, id, index, section,
    ...solid.world({ ...p, u: s.u }), label: (section === 0 ? 'Inner' : 'Depth') + ' point ' + (index + 1) + '. Drag to reshape this corner',
  })));
}
