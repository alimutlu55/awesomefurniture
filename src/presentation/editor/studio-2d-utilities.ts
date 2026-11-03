import { wallLine, type Studio } from '../../domain/studio/studio';
import { isWallUtility, openingNoun } from '../../domain/studio/wall-utilities';
import type { RoomSelection } from '../viewport/studio-renderer';
import { esc } from './editor-format.js';

/** Utility symbols keep a readable screen size and sit outside the wall, clear of furniture footprints. */
export function utilityMarkers(studio: Studio | null, zoom: number) {
  return (studio?.openings ?? []).filter(o => isWallUtility(o.kind)).flatMap(o => {
    const w = studio!.walls.find(w => w.id === o.wall), line = w && wallLine(studio!, w);
    if (!w || !line) return [];
    const anchor = { x: line.a.x + line.ux * o.offset + line.nx * w.thickness / 2,
      z: line.a.z + line.uz * o.offset + line.nz * w.thickness / 2 };
    const offset = w.thickness + 16 / zoom;
    return [{ id: o.id, name: openingNoun(o.kind), anchor, radius: 10 / zoom,
      x: anchor.x - line.nx * offset, z: anchor.z - line.nz * offset }];
  });
}

export function renderUtilities(studio: Studio | null, selection: RoomSelection, zoom: number): string {
  return utilityMarkers(studio, zoom).map(m => {
    const selected = selection?.kind === 'opening' && selection.id === m.id;
    return `<g class="sp2d-opening sp2d-utility sp2d-utility-marker${selected ? ' selected' : ''}" data-opening-id="${m.id}">
      <title>${esc(m.name)}</title>
      <line x1="${m.anchor.x}" y1="${m.anchor.z}" x2="${m.x}" y2="${m.z}" class="sp2d-utility-leader" vector-effect="non-scaling-stroke"/>
      <circle cx="${m.anchor.x}" cy="${m.anchor.z}" r="${2 / zoom}" class="sp2d-utility-anchor"/>
      <rect x="${m.x - m.radius}" y="${m.z - m.radius}" width="${2 * m.radius}" height="${2 * m.radius}"
        rx="${4 / zoom}" class="sp2d-util-box" vector-effect="non-scaling-stroke"/>
      <text x="${m.x}" y="${m.z + 3.5 / zoom}" class="sp2d-util-icon" style="font-size:${11 / zoom}px">${esc(m.name.slice(0, 1).toUpperCase())}</text>
    </g>`;
  }).join('');
}
