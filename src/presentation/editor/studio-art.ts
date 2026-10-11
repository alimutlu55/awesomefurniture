import { STUDIO_TEMPLATES, createStudio } from '../../domain/studio/studio-templates';
import { studioBounds, wallLine } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';

/** Plan of a room seen from above, drawn from its own corners: walls, door and window gaps, and the
 * wardrobe (200 × 60 cm) against its back wall so the scale reads. Chip size by default. */
export function studioPlanSvg(studio: Studio): string {
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
  return `<svg class="shape-chip-art" viewBox="0 0 ${W} ${H}" aria-hidden="true">${wardrobe}`
    + `<path d="${walls}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/>`
    + (openings ? `<path d="${openings}" fill="none" stroke="var(--panel, #fff)" stroke-width="2.6"/>` : '') + '</svg>';
}

/** "No room": the wardrobe alone on an open floor. */
export const noRoomSvg = () => '<svg class="shape-chip-art" viewBox="0 0 44 36" aria-hidden="true">'
  + '<rect x="12" y="13" width="20" height="6" rx=".6" fill="currentColor" fill-opacity=".35"/>'
  + '<path d="M6 30h32" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2" fill="none"/></svg>';

/** Picker entries: no room, then every built-in studio from the registry. */
export const studioChoices = () => [
  { id: 'none' as const, name: 'No room', description: 'Wardrobes on an open floor', art: noRoomSvg() },
  ...STUDIO_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, art: studioPlanSvg(createStudio(t.id)) })),
];
