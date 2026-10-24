import type { Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';
import { createSurfaceBoundaryCursor } from './surface-boundary-cursor';

export function createCeilingSplitCursor(screen: (p: { x: number; y: number; z: number }) => { x: number; y: number }) {
  const cursor = createSurfaceBoundaryCursor('ceiling', screen);
  let latest: Studio | undefined;
  return { ...cursor,
    position: (id: string) => latest && cursor.location(id) ? cursor.handle(latest, id)?.position : undefined,
    move(room: Studio, h: RoomHandle, dx: number, dy: number) { latest = room; cursor.move(room, h, dx, dy); },
    nudge(room: Studio, h: RoomHandle, amount: number) { latest = room; cursor.nudge(room, h, amount); },
  };
}
