import type { EditorCabinet } from '../../application/projects/editor-scene';
import { wallFace, wallLine, type Studio } from '../../domain/studio/studio';
import { fixtureObstacles } from '../../domain/studio/fixtures/fixture-place';
import { gapsAround, type PlacedBox } from '../../domain/studio/scene-gaps';
import type { RoomSelection } from '../viewport/studio-renderer';
import type { Point2D } from './studio-2d-canvas';
import { lengthWithUnit } from './length-unit-state';

export interface PlanDimension { id: string; a: Point2D; b: Point2D; text: string; accent?: boolean; offset: number }
export const cabinetBox = (c: EditorCabinet): PlacedBox => ({ id: c.id, x: c.x, z: c.z, y: c.y, angle: c.angle, w: c.state.w, d: c.state.d, h: c.state.h });

/** Fixture identities use a separate negative range for the shared measuring rule's numeric ids. */
export function fixtureBoxes(studio: Studio | null): PlacedBox[] {
  return fixtureObstacles(studio ?? undefined).map((c, i) => ({ id: -i - 1, x: c.x, z: c.z, y: c.y, angle: c.angle, ...c.state }));
}

export function selectedDimensions(studio: Studio | null, wardrobes: readonly EditorCabinet[], selection: RoomSelection, active: number | null): PlanDimension[] {
  const out: PlanDimension[] = [];
  const opening = selection?.kind === 'opening' ? studio?.openings.find(o => o.id === selection.id) : undefined;
  const wall = studio?.walls.find(w => w.id === (opening?.wall ?? (selection?.kind === 'wall' ? selection.id : null)));
  if (studio && wall) {
    const face = wallFace(studio, wall), line = wallLine(studio, wall);
    if (face && line) {
      const holes = studio.openings.filter(o => o.wall === wall.id && (!opening || o.id === opening.id));
      const edges = [face.start, ...holes.flatMap(o => [o.offset - o.width / 2, o.offset + o.width / 2]), face.end]
        .filter(t => t >= face.start && t <= face.end).sort((a, b) => a - b);
      const at = (t: number) => ({ x: face.from.x + line.ux * (t - face.start), z: face.from.z + line.uz * (t - face.start) });
      for (let i = 1; holes.length && i < edges.length; i++) {
        const a = edges[i - 1]!, b = edges[i]!;
        if (b - a < .1) continue;
        const hole = holes.find(o => Math.abs(o.offset - (a + b) / 2) < .1 && Math.abs(o.width - (b - a)) < .1);
        out.push({ id: `chain-${wall.id}-${i}`, a: at(a), b: at(b), offset: 28,
          text: hole && opening ? `${lengthWithUnit(hole.width)} × ${lengthWithUnit(hole.height)}` : lengthWithUnit(b - a), accent: !!hole });
      }
    }
  }
  const fixtures = fixtureBoxes(studio), boxes = wardrobes.map(cabinetBox);
  const box = selection?.kind === 'fixture' ? fixtures[(studio?.fixtures ?? []).findIndex(f => f.id === selection.id)]
    : !selection ? boxes.find(c => c.id === active) : undefined;
  if (box) for (const g of gapsAround(box, [...boxes, ...fixtures], studio ?? undefined, ['left', 'right', 'back', 'front'])) {
    if (g.distance < .1) continue;
    out.push({ id: `clearance-${g.side}`, a: g.from, b: g.to, offset: 0, text: lengthWithUnit(g.distance), accent: true });
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
