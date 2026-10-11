/**
 * Built-in studios. THIS IS THE ONLY PLACE TO ADD ONE: append an entry. The Studio picker, its plan
 * drawing (drawn from the corners), saving and placement all follow. tests/architecture/studio.test.ts
 * checks every entry: valid walls, room in front of every wall, openings that fit.
 *
 * Built-in rooms are laid out around the wardrobe wall: x = 0 is its middle and the room side of the
 * back wall's surface is at z = 0. Placing a studio moves it so existing wardrobes stand against that
 * wall. Centimetres.
 */
import { STUDIO_DEFAULTS } from './studio';
import type { Studio, StudioCorner, StudioOpening, StudioWall } from './studio';

type Point = readonly [number, number];
const T = STUDIO_DEFAULTS.thickness, H = STUDIO_DEFAULTS.height;

/** A chain of walls through the points, each running so the room is on its front side. Closed rooms
 * repeat no point: `closed` joins the last point back to the first. */
function chain(points: readonly Point[], closed: boolean) {
  const corners: StudioCorner[] = points.map(([x, z], i) => ({ id: 'c' + (i + 1), x, z }));
  const walls: StudioWall[] = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) walls.push({ id: 'w' + (i + 1), a: corners[i]!.id, b: corners[(i + 1) % points.length]!.id, thickness: T, height: H });
  return { corners, walls };
}
/** Centre lines of a room with this clear width and depth behind the wardrobe wall. */
function room(width: number, depth: number): Point[] {
  const x = width / 2 + T / 2, back = -T / 2, front = depth + T / 2;
  return [[-x, back], [x, back], [x, front], [-x, front]];
}
const opening = (id: string, wall: string, kind: 'door' | 'window', offset: number): StudioOpening => ({ id, wall, kind, offset, ...STUDIO_DEFAULTS[kind] });

export interface StudioTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly build: () => Omit<Studio, 'template'>;
}

export const STUDIO_TEMPLATES = [
  {
    id: 'wall', name: 'Wall', description: 'One wall behind the wardrobe',
    build: () => ({ ...chain([[-200, -T / 2], [200, -T / 2]], false), openings: [] }),
  },
  {
    id: 'corner', name: 'Corner', description: 'Two walls meeting in a corner',
    build: () => ({ ...chain([[-170 - T / 2, 260], [-170 - T / 2, -T / 2], [230, -T / 2]], false), openings: [] }),
  },
  {
    id: 'alcove', name: 'Alcove', description: 'A recess in the wall, 220 cm wide and 65 cm deep',
    build: () => {
      const x = 110 + T / 2, d = 65 + T / 2;
      return { ...chain([[-x - 120, d], [-x, d], [-x, -T / 2], [x, -T / 2], [x, d], [x + 120, d]], false), openings: [] };
    },
  },
  {
    id: 'bedroom', name: 'Bedroom', description: 'A 4 × 3.5 m room with a door and a window',
    build: () => ({ ...chain(room(400, 350), true), openings: [opening('o1', 'w2', 'door', 290), opening('o2', 'w4', 'window', 180)] }),
  },
  {
    id: 'walk-in', name: 'Walk-in', description: 'A 2.2 × 2.4 m dressing room with a door',
    build: () => ({ ...chain(room(220, 240), true), openings: [opening('o1', 'w3', 'door', 116)] }),
  },
] as const satisfies readonly StudioTemplate[];

/** A built-in studio, or 'custom' once a person has edited the walls. */
export type StudioTemplateId = typeof STUDIO_TEMPLATES[number]['id'] | 'custom';

export const studioTemplate = (id: string) => (STUDIO_TEMPLATES as readonly StudioTemplate[]).find(t => t.id === id);

/** A fresh copy of a built-in studio. */
export function createStudio(id: typeof STUDIO_TEMPLATES[number]['id']): Studio {
  const template = studioTemplate(id);
  if (!template) throw new Error('Unknown studio ' + id);
  return { template: id, ...structuredClone(template.build()) };
}
