import { edgePoint, surfaceBoundary, type SurfaceKind, type SurfaceLocation } from '../../domain/studio/surface-boundary';
import type { Studio } from '../../domain/studio/studio';
import { projectBoundary } from './boundary-cursor';
import type { RoomHandle } from './studio-editor.ports';

type Screen = (p: { x: number; y: number; z: number }) => { x: number; y: number };
/** One insertion cursor on the actual solid. Moving it never changes geometry or history. */
export function createSurfaceBoundaryCursor(kind: SurfaceKind, screen: Screen) {
  type Cursor = { id: string; at: SurfaceLocation } | null;
  let cursor: Cursor = null, before: Cursor = null;
  const location = (id: string) => cursor?.id === id ? cursor.at : undefined;
  const handle = (room: Studio, id: string) => surfaceSplitHandle(room, kind, id, location(id));
  function move(room: Studio, h: RoomHandle, dx: number, dy: number) {
    const s = surfaceBoundary(room, kind, h.id);
    if (!s) return;
    const origin = screen(h), target = { x: origin.x + dx, y: origin.y + dy };
    let best: { distance: number; at: SurfaceLocation } | null = null;
    for (const edge of s.edges) {
      const hit = projectBoundary(screen, s.world(edge.a), s.world(edge.b), target);
      if (hit && (!best || hit.distance < best.distance - 1e-7 || Math.abs(hit.distance - best.distance) < 1e-7 && edge.key === h.boundary?.edge))
        best = { distance: hit.distance, at: { edge: edge.key, fraction: hit.fraction } };
    }
    if (best) cursor = { id: h.id, at: best.at };
  }
  function nudge(room: Studio, h: RoomHandle, amount: number) {
    const s = surfaceBoundary(room, kind, h.id), edge = s?.edges.find(e => e.key === h.boundary?.edge);
    if (!s || !edge) return;
    const length = (e: typeof edge) => { const a = s.world(e.a), b = s.world(e.b); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); };
    let current = edge, fraction = h.boundary!.fraction, remaining = amount;
    for (let guard = 0; guard < s.edges.length + 1; guard++) {
      const len = length(current), want = fraction * len + remaining;
      if (want >= 0 && want <= len) { cursor = { id: h.id, at: { edge: current.key, fraction: len > 0 ? want / len : 0 } }; return; }
      const forward = want > len, end = s.world(forward ? current.b : current.a);
      remaining = forward ? want - len : want;
      const next = s.edges.find(e => e !== current && [e.a, e.b].some(p => { const q = s.world(p); return Math.hypot(q.x - end.x, q.y - end.y, q.z - end.z) < 1e-7; }));
      if (!next) break;
      const a = s.world(next.a), starts = Math.hypot(a.x - end.x, a.y - end.y, a.z - end.z) < 1e-7;
      current = next; fraction = starts ? 0 : 1; remaining = Math.abs(remaining) * (starts ? 1 : -1);
    }
  }
  return { location, handle, move, nudge, begin() { before = cursor && { id: cursor.id, at: { ...cursor.at } }; }, cancel() { cursor = before; }, clear() { cursor = null; } };
}

export function surfaceSplitHandle(room: Studio, kind: SurfaceKind, id: string, chosen?: SurfaceLocation): RoomHandle | null {
    const s = surfaceBoundary(room, kind, id);
    if (!s) return null;
    let edge = chosen && s.edges.find(e => e.key === chosen.edge);
    let fraction = chosen?.fraction ?? .5;
    if (!edge) {
      const profile = kind === 'ceiling' ? s.ceiling!.profile : null;
      const candidates = s.edges.filter(e => e.kind === 'rim' && e.a.u === 1 && (kind === 'wall' ? e.a.y === s.wall.height && e.b.y === s.wall.height
        : profile?.some((p, k) => k + 1 < profile.length && Math.abs(p.t - e.a.t) < 1e-7 && Math.abs(p.y - e.a.y) < 1e-7)));
      edge = candidates.sort((a, b) => Math.abs(b.b.t - b.a.t) - Math.abs(a.b.t - a.a.t))[0] ?? s.edges[0];
      fraction = .5;
    }
    if (!edge) return null;
    const p = edgePoint(edge, fraction), at = s.world(p);
    return { key: (kind === 'wall' ? 'wall-split:' : 'ceiling-split:') + id, kind: kind === 'wall' ? 'wall-split' : 'ceiling-split',
      id, ...at, index: edge.index, position: p.t, fraction, boundary: { edge: edge.key, fraction },
      label: kind === 'wall' ? 'Add a wall corner here. Drag around any edge to choose where; tap to divide. Arrow keys move along the boundary'
        : 'Add a ceiling shape point here. Drag around any edge to choose where; tap to divide. Arrow keys move along the boundary' };
  }
