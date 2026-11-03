import { nextId, studioBounds, type Studio } from './studio';
import { translateStudio } from './studio-edit';

/** Copies a room with fresh identities, preserving every wall attachment. */
export function mergeStudioRoom(existing: Studio, room: Studio): Studio {
  const used: { id: string }[] = [...existing.corners, ...existing.walls, ...existing.openings, ...existing.ceilings ?? [], ...existing.fixtures ?? []];
  const ids = new Map<string, string>();
  const rename = (prefix: string, list: readonly { id: string }[]) => {
    for (const item of list) { const id = nextId(prefix, used); used.push({ id }); ids.set(item.id, id); }
  };
  rename('c', room.corners); rename('w', room.walls); rename('o', room.openings);
  rename('k', room.ceilings ?? []); rename('f', room.fixtures ?? []);
  const id = (old: string) => ids.get(old)!;
  return { ...existing, template: 'custom',
    corners: [...existing.corners, ...room.corners.map(c => ({ ...c, id: id(c.id) }))],
    walls: [...existing.walls, ...room.walls.map(w => ({ ...w, id: id(w.id), a: id(w.a), b: id(w.b) }))],
    openings: [...existing.openings, ...room.openings.map(o => ({ ...o, id: id(o.id), wall: id(o.wall) }))],
    ...((existing.ceilings?.length || room.ceilings?.length) ? { ceilings: [...existing.ceilings ?? [], ...room.ceilings?.map(c => ({ ...c, id: id(c.id), wall: id(c.wall) })) ?? []] } : {}),
    ...((existing.fixtures?.length || room.fixtures?.length) ? { fixtures: [...existing.fixtures ?? [], ...room.fixtures?.map(f => ({ ...f, id: id(f.id), wall: id(f.wall) })) ?? []] } : {}),
  };
}

/** First valid position, one metre between outer wall faces: right, front, left, back. */
export function addRoomBeside(existing: Studio, room: Studio, problem: (studio: Studio) => string | null): { studio: Studio | null; reason: string | null } {
  const a = studioBounds(existing), b = studioBounds(room);
  if (!a || !b) return { studio: null, reason: 'Add walls before adding another room.' };
  const positions = [[a.x1 + 100 - b.x0, a.z0 - b.z0], [a.x0 - b.x0, a.z1 + 100 - b.z0],
    [a.x0 - 100 - b.x1, a.z0 - b.z0], [a.x0 - b.x0, a.z0 - 100 - b.z1]];
  let reason: string | null = null;
  for (const [dx, dz] of positions) {
    const studio = mergeStudioRoom(existing, translateStudio(room, dx!, dz!));
    const why = problem(studio);
    if (!why) return { studio, reason: null };
    reason ??= why;
  }
  return { studio: null, reason: reason ?? 'There is no free space beside these rooms.' };
}
