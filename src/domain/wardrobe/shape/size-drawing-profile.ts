import { ensureCounterClockwise, profileExtent, type ProfileVertex } from '../../geometry/profile-polygon';
import type { SurfaceProfile, SurfaceRef, SurfaceView } from '../../studio/surface-profile';
import { resolveShape, type ShapedDesign } from './wardrobe-shape';

export interface DrawingCabinet { id: number; y: number; state: ShapedDesign & { d: number } }
/** The wardrobe's existing front/rear roof model, presented to the shared drawing in centimetres. */
export function wardrobeDrawingProfile(c: DrawingCabinet, view: SurfaceView = 'front'): SurfaceProfile {
  const shape = resolveShape(c.state), floor = c.y || 0;
  const top = view === 'front' ? shape.top : [
    { x: 0, y: Math.max(...(shape.back ?? shape.top.map(p => p.y))) },
    { x: c.state.d, y: Math.max(...shape.top.map(p => p.y)) },
  ];
  const width = view === 'front' ? c.state.w : c.state.d, ref: SurfaceRef = { kind: 'wall', id: 'wardrobe:' + c.id };
  return { ref, view, primary: view === 'front', points: ensureCounterClockwise([
    { x: 0, y: floor }, { x: width, y: floor }, ...[...top].reverse().map(p => ({ x: p.x, y: floor + p.y })),
  ]), bounds: { minX: -600, maxX: 1200, minY: 0, maxY: floor + 350 },
  wall: { id: ref.id, a: '', b: '', height: floor + c.state.h, thickness: 0 },
  context: { from: 0, to: width, top: floor + c.state.h }, origin: 0, fromLabel: view === 'front' ? 'From the left' : 'From the back',
  openings: [], depth: c.state.d };
}

/** A wardrobe stands on a level base and has upright sides; its editable roof runs left to right. */
export function wardrobeDrawingRoof(points: readonly ProfileVertex[]): { width: number; left: number; floor: number; top: { x: number; y: number }[] } | null {
  const box = profileExtent(points), near = (a: number, b: number) => Math.abs(a - b) < .001;
  const polygon = ensureCounterClockwise([...points]);
  const left = polygon.findIndex(p => near(p.x, box.minX) && near(p.y, box.minY));
  if (left < 0) return null;
  const ordered = polygon.map((_, i) => polygon[(i + left) % polygon.length]!);
  if (!near(ordered[1]!.x, box.maxX) || !near(ordered[1]!.y, box.minY)) return null;
  const top = ordered.slice(2).reverse().map(p => ({ x: p.x - box.minX, y: p.y - box.minY }));
  if (top.length < 2 || !near(top[0]!.x, 0) || !near(top.at(-1)!.x, box.maxX - box.minX)) return null;
  if (top.some((p, i) => p.y < 40 || (i > 0 && p.x < top[i - 1]!.x - .001))) return null;
  return { width: box.maxX - box.minX, left: box.minX, floor: box.minY, top };
}
