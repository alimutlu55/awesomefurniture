import { STUDIO_TEMPLATES, createStudio } from '../../domain/studio/studio-templates';
import { studioBounds, wallLine } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';

/** Plan of a room seen from above, drawn from its own corners: walls, door and window gaps, and the
 * wardrobe (200 × 60 cm) against its back wall so the scale reads. Chip size by default. */
export function studioPlanSvg(studio: Studio, className = 'shape-chip-art'): string {
  const W = 44, H = 36, pad = 4, b = studioBounds(studio)!;
  const x0 = Math.min(b.x0, -100), x1 = Math.max(b.x1, 100), z0 = b.z0, z1 = Math.max(b.z1, 80);
  const scale = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (z1 - z0));
  const ox = (W - (x1 - x0) * scale) / 2 - x0 * scale, oy = (H - (z1 - z0) * scale) / 2 - z0 * scale;
  const X = (x: number) => (ox + x * scale).toFixed(1), Y = (z: number) => (oy + z * scale).toFixed(1);
  let walls = '', openings = '';
  for (const w of studio.walls) {
    const line = wallLine(studio, w);
    if (!line) continue;
    walls += `M${X(line.a.x)} ${Y(line.a.z)}L${X(line.b.x)} ${Y(line.b.z)}`;
    for (const o of studio.openings.filter(o => o.wall === w.id)) {
      const s = o.offset - o.width / 2, e = o.offset + o.width / 2;
      openings += `M${X(line.a.x + line.ux * s)} ${Y(line.a.z + line.uz * s)}L${X(line.a.x + line.ux * e)} ${Y(line.a.z + line.uz * e)}`;
    }
  }
  const wardrobe = `<rect x="${X(-100)}" y="${Y(0)}" width="${(200 * scale).toFixed(1)}" height="${(60 * scale).toFixed(1)}" rx=".6" fill="currentColor" fill-opacity=".35"/>`;
  return `<svg class="${className}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${wardrobe}`
    + `<path d="${walls}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/>`
    + (openings ? `<path d="${openings}" fill="none" stroke="var(--panel, #fff)" stroke-width="2.6"/>` : '') + '</svg>';
}

/** "No room": the wardrobe alone on an open floor. */
export const noRoomSvg = (className = 'shape-chip-art') => '<svg class="' + className + '" viewBox="0 0 44 36" aria-hidden="true">'
  + '<rect x="12" y="13" width="20" height="6" rx=".6" fill="currentColor" fill-opacity=".35"/>'
  + '<path d="M6 30h32" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2" fill="none"/></svg>';

/** Picker entries: no room, then every built-in studio from the registry. */
export const studioChoices = (className?: string) => [
  { id: 'none' as const, name: 'No room', description: 'Wardrobes on an open floor', art: noRoomSvg(className) },
  ...STUDIO_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, art: studioPlanSvg(createStudio(t.id), className) })),
];

/** The parts a person adds to a room, drawn in the Add item style: a wall seen from the front, and one
 * with a door, a window or an archway in it. */
export const ROOM_PARTS = [
  { kind: 'wall', name: 'Wall', description: 'Adds a wall from a free wall end, or one standing in the room' },
  { kind: 'door', name: 'Door', description: 'Adds a door to the selected wall, or a free one' },
  { kind: 'window', name: 'Window', description: 'Adds a window to the selected wall, or a free one' },
  { kind: 'archway', name: 'Archway', description: 'Adds an archway to the selected wall, or a free one' },
] as const;
export function roomPartArt(kind: typeof ROOM_PARTS[number]['kind']): string {
  const wall = '<path d="M14 26 104 14 132 30 42 44Z" fill="#efe9df"/><path d="M42 44v56l90-14V30Z" fill="#e2d9cb"/><path d="M14 26v56l28 18V44Z" fill="#d3c8b7"/>';
  const holes = {
    wall: '',
    door: '<path d="M74 97V61l20-3v36Z" fill="#f6f2ea" stroke="#b9ab95" stroke-width="1.5"/><path d="M89 78h3" stroke="#8d7d65" stroke-width="2"/>',
    window: '<path d="M68 76V52l34-5v24Z" fill="#cfe1e8" stroke="#b9ab95" stroke-width="1.5"/><path d="M85 49v25M68 64l34-5" stroke="#b9ab95" stroke-width="1.2"/><path d="M66 78l38-6" stroke="#f6f2ea" stroke-width="3"/>',
    archway: '<path d="M72 98V68a12 12 0 0 1 24-4v31Z" fill="#c8bba6"/>',
  }[kind];
  return '<svg class="product-art" viewBox="0 0 146 110" aria-hidden="true">' + wall + holes + '</svg>';
}
