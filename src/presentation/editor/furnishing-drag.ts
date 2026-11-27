import type { Studio, StudioFurnishing } from '../../domain/studio/studio';
import { wallFace, wallLine } from '../../domain/studio/studio';
import { ROOM_SNAP_CM, resolveAlignment, type AlignTarget } from '../../domain/geometry/alignment';
import { snapToWall, type Pose } from '../../domain/studio/studio-placement';
import { furnishingKind } from '../../domain/studio/furnishings/furnishing-kinds';
import { furnishingNoun } from '../../domain/studio/furnishings/furnishing-validation';
import type { Guide } from './studio-drag';

export type FurnishingTarget = AlignTarget<number>;
const turned = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

/** Where a furnishing flush against a wall lines up along it: its middle on the wall's or a window's, its side against the
 * wall's end, and beside or centred on another furnishing against the same wall (a bedside table beside the bed). Each is
 * a value of its middle along the wall's line from corner a; `src` is where the guide is drawn. */
export function furnishingTargets(room: Studio, wallId: string, f: StudioFurnishing): FurnishingTarget[] {
  const w = room.walls.find(x => x.id === wallId), line = w && wallLine(room, w), face = w && wallFace(room, w);
  if (!w || !line || !face) return [];
  const half = f.width / 2, mid = (face.start + face.end) / 2, out: FurnishingTarget[] = [{ v: mid, label: 'Centred on the wall', src: mid }];
  for (const o of room.openings) if (o.wall === wallId && o.kind === 'window') out.push({ v: o.offset, label: 'Centred under the window', src: o.offset });
  out.push({ v: face.start + half, label: 'Against the wall', src: face.start }, { v: face.end - half, label: 'Against the wall', src: face.end });
  for (const o of room.furnishings ?? []) {
    if (o.id === f.id || turned(o.angle, line.angle) > .5) continue;
    const t = (o.x - line.a.x) * line.ux + (o.z - line.a.z) * line.uz, l = t - o.width / 2, r = t + o.width / 2;
    out.push({ v: t, label: 'Centred on the ' + furnishingNoun(o), src: t }, { v: l - half - 3, label: 'Beside the ' + furnishingNoun(o), src: l },
      { v: r + half + 3, label: 'Beside the ' + furnishingNoun(o), src: r });
  }
  return out;
}

/** Where a dragged furnishing goes for a pointer that puts its middle at `raw`: near a wall (15 cm, turned less than
 * 20°) it squares up flush against it and lines up along it, holding `lock` a little longer; `free` (Shift) and a rug
 * go just where the pointer says. The guide is a line on the floor out from the wall where it lines up. */
export function furnishingDragGoal(room: Studio, f: StudioFurnishing, raw: Pose, lock: FurnishingTarget | null, free: boolean, tolerance = ROOM_SNAP_CM) {
  const none = { pose: raw, lock: null, guides: [] as Guide[] };
  if (free || furnishingKind(f.kind)?.flat) return none;
  const flush = snapToWall(room, raw, { w: f.width, d: f.depth }, 15, 20);
  if (!flush) return none;
  const w = room.walls.find(x => {
    const l = wallLine(room, x);
    return l && turned(l.angle, flush.angle) < .5 && Math.abs((flush.x - l.a.x) * l.nx + (flush.z - l.a.z) * l.nz - x.thickness / 2 - f.depth / 2) < 1;
  });
  const line = w && wallLine(room, w), face = w && wallFace(room, w);
  if (!w || !line || !face) return { pose: flush, lock: null, guides: [] as Guide[] };
  const t = (flush.x - line.a.x) * line.ux + (flush.z - line.a.z) * line.uz;
  const hit = resolveAlignment(t, furnishingTargets(room, w.id, f), { tolerance, hold: 1.5, lock, within: [face.start + f.width / 2, face.end - f.width / 2] });
  if (!hit) return { pose: flush, lock: null, guides: [] as Guide[] };
  const at = (s: number, out: number) => ({ x: line.a.x + line.ux * s + line.nx * (w.thickness / 2 + out), y: 1, z: line.a.z + line.uz * s + line.nz * (w.thickness / 2 + out) });
  const guides: Guide[] = hit.src === undefined ? [] : [{ a: at(hit.src, 0), b: at(hit.src, f.depth + 25), label: hit.label }];
  return { pose: { x: flush.x + line.ux * (hit.v - t), z: flush.z + line.uz * (hit.v - t), angle: flush.angle }, lock: hit, guides };
}
