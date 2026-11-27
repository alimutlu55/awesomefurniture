import { studioWallItems, wallItemSegments } from '../../domain/studio/studio-wall-items';
import type { EditorCabinet } from '../../application/projects/editor-scene';
import { wallFace, wallLine, type Studio } from '../../domain/studio/studio';
import { fixtureObstacles } from '../../domain/studio/fixtures/fixture-place';
import { gapsAround, type PlacedBox } from '../../domain/studio/scene-gaps';
import { furnishingBoxes, isFlat, steadyGap } from '../../domain/studio/furnishings/furnishing-place';
import type { RoomSelection } from '../viewport/studio-renderer';
import type { Point2D } from './studio-2d-canvas';
import { lengthWithUnit } from './length-unit-state';

export interface PlanDimension { id: string; a: Point2D; b: Point2D; text: string; accent?: boolean; offset: number; side?: 'left' | 'right'; priority?: number }
export const cabinetBox = (c: EditorCabinet): PlacedBox => ({ id: c.id, x: c.x, z: c.z, y: c.y, angle: c.angle, w: c.state.w, d: c.state.d, h: c.state.h });

/** Fixture identities use a separate negative range for the shared measuring rule's numeric ids. */
export function fixtureBoxes(studio: Studio | null): PlacedBox[] {
  return fixtureObstacles(studio ?? undefined).map((c, i) => ({ id: -i - 1, x: c.x, z: c.z, y: c.y, angle: c.angle, ...c.state }));
}

export function selectedDimensions(studio: Studio | null, wardrobes: readonly EditorCabinet[], selection: RoomSelection, active: number | null): PlanDimension[] {
  const out: PlanDimension[] = [];
  const boxes = wardrobes.map(cabinetBox), fixtures = fixtureBoxes(studio), furnishings = furnishingBoxes(studio ?? undefined);
  const items = studio ? studioWallItems(studio, boxes) : [];
  const selectedItem = items.find(item => selection ? item.kind === selection.kind && item.id === selection.id : item.kind === 'furniture' && item.id === active);
  const wall = studio?.walls.find(w => w.id === (selectedItem?.wall ?? (selection?.kind === 'wall' ? selection.id : null)));
  if (studio && wall) {
    const face = wallFace(studio, wall), line = wallLine(studio, wall);
    if (face && line) {
      const segments = wallItemSegments(studio, wall.id, items, selectedItem);
      const at = (t: number) => ({ x: face.from.x + line.ux * (t - face.start), z: face.from.z + line.uz * (t - face.start) });
      for (const [i, segment] of segments.entries()) {
        const { from, to, item } = segment;
        const own = selectedItem && item === selectedItem;
        const text = own ? `${lengthWithUnit(item.width)} × ${lengthWithUnit(item.kind === 'opening' ? item.height : item.depth ?? item.height)}` : lengthWithUnit(to - from);
        out.push({ id: `chain-${wall.id}-${i + 1}`, a: at(from), b: at(to), offset: 28, text, accent: !!(own || !selectedItem && item), priority: own ? 0 : 1,
          ...(segment.side ? { side: segment.side } : {}) });
      }
    }
  }
  // Boxes are made for the furnishings that stand up, in their order.
  const standing = (studio?.furnishings ?? []).filter(f => !isFlat(f));
  const furnishing = selection?.kind === 'furnishing' ? standing.find(f => f.id === selection.id) : undefined;
  const box = selection?.kind === 'fixture' ? fixtures[(studio?.fixtures ?? []).findIndex(f => f.id === selection.id)]
    : selection?.kind === 'furnishing' ? furnishings[standing.findIndex(f => f.id === selection.id)]
    : !selection ? boxes.find(c => c.id === active) : undefined;
  if (box) for (const g of gapsAround(box, [...boxes, ...fixtures, ...furnishings], studio ?? undefined, ['left', 'right', 'back', 'front'])) {
    if (g.distance < .1) continue;
    if (g.side === 'left' || g.side === 'right') {
      const at = out.findIndex(d => d.side === g.side && !d.accent && Math.abs(Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z) - g.distance) < .1);
      if (at >= 0) out.splice(at, 1);
    }
    // A furnishing's gaps start from the middle of each side, so they slide with it instead of jumping while it is dragged.
    const line = furnishing ? steadyGap(furnishing, g) : null;
    out.push({ id: `clearance-${g.side}`, a: line?.from ?? g.from, b: line?.to ?? g.to, offset: 0, text: lengthWithUnit(g.distance), accent: true, priority: 2 });
  }
  return out;
}

/** Screen-space architectural dimension: extensions, parallel line and diagonal end ticks. */
export function dimensionSvg(a: Point2D, b: Point2D, offset: number, accent = false): string {
  const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
  if (!length) return '';
  const ux = dx / length, uz = dz / length, nx = -uz, nz = ux;
  const p = { x: a.x + nx * offset, z: a.z + nz * offset }, q = { x: b.x + nx * offset, z: b.z + nz * offset };
  const line = (a: Point2D, b: Point2D) => `<line x1="${a.x}" y1="${a.z}" x2="${b.x}" y2="${b.z}"/>`;
  const tick = (p: Point2D) => line({ x: p.x - (ux + nx) * 3, z: p.z - (uz + nz) * 3 }, { x: p.x + (ux + nx) * 3, z: p.z + (uz + nz) * 3 });
  return `<g class="sp2d-dimension-line${accent ? ' sp2d-accent' : ''}">${line(a, { x: p.x + nx * 4, z: p.z + nz * 4 })}
    ${line(b, { x: q.x + nx * 4, z: q.z + nz * 4 })}${line(p, q)}${tick(p)}${tick(q)}</g>`;
}
