import { splitWall } from '../../domain/studio/studio-edit';
import { splitCeilingPanel } from '../../domain/studio/studio-ceiling';
import { moveSurfaceControl, splitSurfaceBoundary, surfaceBoundary, type SurfaceKind } from '../../domain/studio/surface-boundary';
import { roomHeight } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';
import type { RoomHandle } from './studio-editor.ports';
import { measureNumber, unitSuffix } from './editor-format';

export function boundaryHandles(room: Studio, kind: SurfaceKind, id: string): RoomHandle[] {
  const s = surfaceBoundary(room, kind, id);
  if (!s?.part.outline) return [];
  const axis = s.ceiling?.run === 'across' ? { x: s.line.nx, z: s.line.nz } : { x: s.line.ux, z: s.line.uz };
  return s.controls.flatMap((control, index) => {
    const p = s.points[control.index];
    if (!p) return [];
    const raw = s.world({ ...p, u: control.u }), at = { ...raw, y: kind === 'ceiling' ? Math.min(roomHeight(room), raw.y) : raw.y };
    return [{ key: 'boundary:' + kind + ':' + id + ':' + index, kind: 'boundary-point' as const, id, index, surface: kind,
      ...at, ux: axis.x, uz: axis.z,
      label: 'Shape point, ' + measureNumber(at.y) + unitSuffix() + ' high. Drag to reshape this edge; thickness stays consistent' }];
  });
}
export function boundaryDrag(original: Studio, last: Studio, h: RoomHandle, delta: { s: number; y: number }) {
  const kind = h.surface!, a = surfaceBoundary(original, kind, h.id)!, b = surfaceBoundary(last, kind, h.id)!;
  const control = a.controls[h.index!]!, from = a.points[control.index]!, now = b.points[b.controls[h.index!]!.index]!;
  const visible = (s: typeof a, p: typeof from) => kind === 'ceiling' ? Math.min(p.y, roomHeight(original) - (s.ceiling?.edgeRise ?? 0) * control.u) : p.y;
  const fromY = visible(a, from), nowY = visible(b, now);
  return (f: number) => moveSurfaceControl(original, kind, h.id, h.index!, { t: now.t + (from.t + delta.s - now.t) * f, y: nowY + (fromY + delta.y - nowY) * f });
}
export function nudgeBoundary(room: Studio, h: RoomHandle, across: number, up: number) {
  const s = surfaceBoundary(room, h.surface!, h.id), control = s?.controls[h.index!], p = control && s!.points[control.index];
  return p ? moveSurfaceControl(room, h.surface!, h.id, h.index!, { t: p.t + across, y: p.y + up }) : null;
}

export function insertBoundaryPoint(room: Studio, h: RoomHandle) {
  const kind = h.kind === 'wall-split' ? 'wall' : 'ceiling';
  if (!h.boundary) return kind === 'wall' ? splitWall(room, h.id, h.position) : splitCeilingPanel(room, h.id, h.index!, h.position, h.fraction);
  const surface = surfaceBoundary(room, kind, h.id), edge = surface?.edges.find(e => e.key === h.boundary!.edge);
  if (!surface || !edge) return null;
  if (kind === 'wall' && !surface.part.outline && edge.kind === 'rim' && edge.a.y === edge.b.y)
    return splitWall(room, h.id, h.position);
  if (kind === 'ceiling' && !surface.part.outline && edge.kind === 'rim' && edge.a.u === 1 && edge.index < surface.ceiling!.profile.length - 1)
    return splitCeilingPanel(room, h.id, edge.index, h.position);
  return splitSurfaceBoundary(room, kind, h.id, h.boundary);
}
