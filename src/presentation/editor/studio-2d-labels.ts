import type { EditorCabinet } from '../../application/projects/editor-scene';
import type { Studio } from '../../domain/studio/studio';
import { detectRooms, door2DPlan, wall2DPlan } from '../../domain/studio/studio-plan';
import type { RoomSelection } from '../viewport/studio-renderer';
import { createTransform, type Point2D, type ViewportTransform } from './studio-2d-canvas';
import { lengthWithUnit } from './length-unit-state';

export interface LabelRect { x: number; y: number; width: number; height: number }
export interface PlanLabel {
  id: string; kind: 'dimension' | 'guide' | 'room' | 'drawing'; text: string; detail?: string;
  x: number; y: number; width: number; height: number; angle: number; scale: number; box: LabelRect;
  wallId?: string; anchor?: Point2D;
}
type Guide = { a: Point2D; b: Point2D; label: string };
interface Options {
  studio: Studio | null; wardrobes: readonly EditorCabinet[]; transform: ViewportTransform;
  selection: RoomSelection; exclusions?: readonly LabelRect[]; guides?: readonly Guide[];
  drawing?: { start: Point2D; current: Point2D } | null;
  measureText?: (text: string) => number;
}
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const pad = (r: LabelRect, gap: number): LabelRect => ({ x: r.x - gap, y: r.y - gap, width: r.width + gap * 2, height: r.height + gap * 2 });
const rectPoints = (r: LabelRect): Point2D[] => [{ x: r.x, z: r.y }, { x: r.x + r.width, z: r.y }, { x: r.x + r.width, z: r.y + r.height }, { x: r.x, z: r.y + r.height }];
export const rectanglesOverlap = (a: LabelRect, b: LabelRect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const bounds = (p: readonly Point2D[]): LabelRect => {
  const xs = p.map(v => v.x), zs = p.map(v => v.z);
  return { x: Math.min(...xs), y: Math.min(...zs), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...zs) - Math.min(...zs) };
};

/** Separating axes keep diagonal walls/furniture clear without blocking their entire bounding box. */
export function polygonOverlapsRect(polygon: readonly Point2D[], rect: LabelRect): boolean {
  if (!rectanglesOverlap(bounds(polygon), rect)) return false;
  const corners = rectPoints(rect);
  const axes = [{ x: 1, z: 0 }, { x: 0, z: 1 }, ...polygon.map((p, i) => {
    const q = polygon[(i + 1) % polygon.length]!;
    return { x: -(q.z - p.z), z: q.x - p.x };
  })];
  return axes.every(axis => {
    const a = polygon.map(p => p.x * axis.x + p.z * axis.z), b = corners.map(p => p.x * axis.x + p.z * axis.z);
    return Math.max(...a) > Math.min(...b) && Math.max(...b) > Math.min(...a);
  });
}

/** Visible text has its own screen-space layer and never occupies geometry or another label's space. */
export function layoutPlanLabels({ studio, wardrobes, transform, selection, exclusions = [], guides = [], drawing, measureText = text => text.length * 7.5 }: Options): PlanLabel[] {
  const { toScreen } = createTransform(transform);
  const scale = Math.min(1, transform.zoom / .6);
  const gap = 5 * scale;
  const objects: Point2D[][] = [];
  const addObject = (points: readonly Point2D[]) => objects.push(points.map(toScreen));
  const wallPlans = studio?.walls.flatMap(w => { const plan = wall2DPlan(studio, w); return plan ? [{ w, plan }] : []; }) ?? [];
  for (const { plan } of wallPlans) addObject(plan.solid);
  if (studio) for (const opening of studio.openings) {
    if (opening.kind !== 'door') continue;
    const door = door2DPlan(studio, opening);
    if (!door) continue;
    const turn = Math.atan2(Math.sin(door.arcEndAngle - door.arcStartAngle), Math.cos(door.arcEndAngle - door.arcStartAngle));
    addObject([door.hingePoint, ...Array.from({ length: 17 }, (_, i) => {
      const angle = door.arcStartAngle + turn * i / 16;
      return { x: door.hingePoint.x + Math.cos(angle) * door.radius, z: door.hingePoint.z + Math.sin(angle) * door.radius };
    })]);
  }
  for (const c of wardrobes) {
    const a = c.angle * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    addObject([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
      x: c.x + x! * c.state.w / 2 * co + z! * c.state.d / 2 * si,
      z: c.z - x! * c.state.w / 2 * si + z! * c.state.d / 2 * co,
    })));
  }
  for (const c of studio?.corners ?? []) {
    const p = toScreen(c);
    const radius = 12 * scale + 1;
    objects.push(rectPoints({ x: p.x - radius, y: p.z - radius, width: radius * 2, height: radius * 2 }));
  }
  const occupied = [...exclusions];
  const labels: PlanLabel[] = [];
  const fits = (box: LabelRect) => box.x >= 8 && box.y >= 8 && box.x + box.width <= transform.width - 8 && box.y + box.height <= transform.height - 8
    && !occupied.some(r => rectanglesOverlap(pad(box, gap), r))
    && !objects.some(p => polygonOverlapsRect(p, pad(box, gap)));
  const place = (label: Omit<PlanLabel, 'x' | 'y' | 'box' | 'scale'>, candidates: Iterable<Point2D & { anchor?: Point2D }>, within?: (box: LabelRect) => boolean) => {
    label = { ...label, width: label.width * scale, height: label.height * scale };
    const radians = label.angle * Math.PI / 180;
    const width = Math.abs(Math.cos(radians)) * label.width + Math.abs(Math.sin(radians)) * label.height;
    const height = Math.abs(Math.sin(radians)) * label.width + Math.abs(Math.cos(radians)) * label.height;
    for (const p of candidates) {
      const box = { x: p.x - width / 2, y: p.z - height / 2, width, height };
      if (!fits(box) || within && !within(box)) continue;
      labels.push({ ...label, x: p.x, y: p.z, box, scale, ...(p.anchor ? { anchor: p.anchor } : {}) });
      occupied.push(box);
      return;
    }
    // Crowded/offscreen labels wait for more space or selection, rather than cover the plan.
  };
  function* around(p: Point2D, width: number): Generator<Point2D> {
    for (const base of [28, 44, 56]) {
      const distance = base * scale;
      for (const [x, z] of [[0, -distance], [0, distance], [width * scale / 2 + distance, 0], [-width * scale / 2 - distance, 0], [distance, -distance], [-distance, distance]]) {
        yield { x: p.x + x!, z: p.z + z! };
      }
    }
  }
  if (guides.length) {
    const text = [...new Set(guides.map(g => g.label))].join(' · ');
    const anchor = toScreen(guides[0]!.b), width = Math.ceil(measureText(text)) + 24;
    place({ id: 'alignment', kind: 'guide', text, width, height: 28, angle: 0, anchor }, around(anchor, width));
  }
  if (drawing) {
    const text = lengthWithUnit(Math.hypot(drawing.current.x - drawing.start.x, drawing.current.z - drawing.start.z));
    const anchor = toScreen({ x: (drawing.start.x + drawing.current.x) / 2, z: (drawing.start.z + drawing.current.z) / 2 });
    const width = Math.max(64, Math.ceil(measureText(text)) + 24);
    place({ id: 'drawing', kind: 'drawing', text, width, height: 26, angle: 0, anchor }, around(anchor, width));
  }
  wallPlans.sort((a, b) => Number(selection?.kind === 'wall' && selection.id === b.w.id) - Number(selection?.kind === 'wall' && selection.id === a.w.id) || b.plan.faceLength - a.plan.faceLength);
  for (const { w, plan } of wallPlans) {
    const a = toScreen(plan.faceFrom), b = toScreen(plan.faceTo), dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < 1 || !rectanglesOverlap(pad(bounds([a, b]), 2), { x: 0, y: 0, width: transform.width, height: transform.height })) continue;
    const text = lengthWithUnit(plan.faceLength), width = Math.max(64, Math.ceil(measureText(text)) + 24);
    const selected = selection?.kind === 'wall' && selection.id === w.id;
    if (!selected && length < (width + 12) * scale) continue;
    let angle = Math.atan2(dz, dx) * 180 / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    const centreFraction = Math.max(0, Math.min(1, ((transform.width / 2 - a.x) * dx + (transform.height / 2 - a.z) * dz) / length ** 2));
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const fractions = mid.x < 0 || mid.x > transform.width || mid.z < 0 || mid.z > transform.height ? [centreFraction, .5, .25, .75, .1, .9] : [.5, .35, .65, .2, .8, centreFraction];
    function* candidates(): Generator<Point2D & { anchor: Point2D }> {
      for (const base of [28, 44, 56]) {
        const distance = base * scale;
        for (const fraction of fractions) for (const side of [1, -1]) {
          const anchor = { x: a.x + dx * fraction, z: a.z + dz * fraction };
          yield { x: anchor.x - dz / length * distance * side, z: anchor.z + dx / length * distance * side, anchor };
        }
      }
    }
    place({ id: w.id, kind: 'dimension', text, width, height: 26, angle, wallId: w.id, anchor: mid }, candidates());
  }
  if (studio) for (const room of detectRooms(studio)) {
    const text = room.name, detail = `${room.areaM2.toFixed(1)} m²`, width = Math.max(100, Math.ceil(measureText(text)) + 24);
    const anchor = toScreen(room.centroid), polygon = room.polygon.map(toScreen);
    const contains = (p: Point2D) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i]!, b = polygon[j]!;
        if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
      }
      return inside;
    };
    place({ id: `room-${labels.length}`, kind: 'room', text, detail, width, height: 44, angle: 0 }, [anchor, ...around(anchor, width)], box => rectPoints(box).every(contains));
  }
  return labels;
}

export function renderPlanLabels(labels: readonly PlanLabel[]): string {
  const leaders: string[] = [];
  const badges = labels.map(label => {
    if (label.kind === 'dimension' && label.anchor) {
      const dx = label.anchor.x - label.x, dy = label.anchor.z - label.y;
      const end = Math.min(label.box.width / 2 / Math.max(.001, Math.abs(dx)), label.box.height / 2 / Math.max(.001, Math.abs(dy)));
      leaders.push(`<line class="sp2d-dimension-leader" x1="${label.anchor.x}" y1="${label.anchor.z}"
        x2="${label.x + dx * end}" y2="${label.y + dy * end}"/>`);
    }
    return `<g class="sp2d-plan-label sp2d-${label.kind}-label${label.wallId ? ' sp2d-dim-badge' : ''}"
      data-label-kind="${label.kind}" data-label-id="${escape(label.id)}" transform="translate(${label.x},${label.y}) rotate(${label.angle})">
      <rect x="${-label.width / 2}" y="${-label.height / 2}" width="${label.width}" height="${label.height}" rx="${6 * label.scale}" class="sp2d-dim-bg"/>
      <text x="0" y="${(label.detail ? -4 : 4) * label.scale}" class="sp2d-dim-text" style="font-size:${12 * label.scale}px">${escape(label.text)}</text>
      ${label.detail ? `<text x="0" y="${14 * label.scale}" class="sp2d-room-area" style="font-size:${11 * label.scale}px">${escape(label.detail)}</text>` : ''}
    </g>`;
  }).join('');
  return leaders.join('') + badges;
}
