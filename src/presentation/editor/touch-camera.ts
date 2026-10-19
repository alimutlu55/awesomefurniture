import type { Vector3 } from 'three';

type ScreenPoint = { clientX: number; clientY: number };
type Point = { x: number; y: number; z: number };
interface TouchCameraPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>,
    'panBy' | 'cameraZoomPoint' | 'cameraZoomDistance' | 'cameraDistance' | 'zoomOutTo' | 'cameraFitDistance' | 'availableRoom'>>;
  readonly cameraState: { az: number; el: number; dist: number; tgt: Vector3; tgtY: number; panned?: boolean };
  /** The furniture in the scene, and whether the active piece is chosen: what a turn of the view goes around. */
  readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene' | 'activeCabinet'>;
  readonly selectionState: { readonly focusOn: boolean };
  /** The editor lifetime's frames (editor-lifetime.js), so a view following a drag stops with the editor. */
  readonly lifetime: { frame(fn: (now: number) => void): unknown; cancelFrame(id: never): void; cleanup(fn: () => void): void };
}

/** How close to the edge of the view a dragging finger starts moving the view, and how fast at the very edge. */
export const EDGE_ZONE = 48, EDGE_SPEED = 720;

/**
 * The camera under a person's fingers on a touch screen.
 * - Spreading the fingers zooms in about what is between them: that point stays under them, as on a map. Pinching
 *   them together zooms out toward the middle of the studio, so zooming out always ends on all of it.
 * - One finger turns the view around the furniture (the chosen piece, or the one nearest the view), not around
 *   whatever was last zoomed into: the piece keeps its place on screen and comes round to the middle as the view turns,
 *   backing off if needed until it is seen whole, so there is room around it to keep turning.
 * - A drag held near the edge of the view moves the view on, so a piece can be taken further than the screen shows.
 */
export function createTouchCamera({ dom, camera, cameraState, lifetime, model, selectionState }: TouchCameraPorts) {
  /** The point being zoomed in about, chosen once per pinch: what was under the fingers when it began zooming in. */
  let anchor: Vector3 | null = null;
  let follow: { at: ScreenPoint; move(at: ScreenPoint): void; holding(): boolean; frame: unknown; last: number } | null = null;

  /** Two fingers moved from `before` to `now`: they pan the view together, and zoom it in about the point between them
   * or out toward the middle of the studio. */
  function pinch(before: readonly [ScreenPoint, ScreenPoint], now: readonly [ScreenPoint, ScreenPoint]) {
    const mid = (p: readonly [ScreenPoint, ScreenPoint]) => ({ clientX: (p[0].clientX + p[1].clientX) / 2, clientY: (p[0].clientY + p[1].clientY) / 2 });
    const span = (p: readonly [ScreenPoint, ScreenPoint]) => Math.hypot(p[0].clientX - p[1].clientX, p[0].clientY - p[1].clientY);
    const from = mid(before), to = mid(now);
    camera.panBy(to.clientX - from.clientX, to.clientY - from.clientY);
    if (span(now) > 0 && span(before) > 0) {
      const next = camera.cameraDistance(cameraState.dist * span(before) / span(now));
      if (next > cameraState.dist) { anchor = null; camera.zoomOutTo(next); }
      else camera.cameraZoomDistance(next, anchor ??= camera.cameraZoomPoint(to));
    }
    cameraState.panned = true;
  }
  /** What a turn goes around: the chosen piece, or the piece nearest the view's target, and the middle of it. */
  function pivot() {
    const pieces = model.scene.wardrobes, t = cameraState.tgt;
    if (!pieces.length) return null;
    const near = (c: { x: number; z: number }) => Math.hypot(c.x - t.x, c.z - t.z);
    const c = selectionState.focusOn ? model.activeCabinet() : pieces.reduce((a, b) => near(b) < near(a) ? b : a);
    return { piece: c, at: { x: c.x, y: (c.y || 0) + c.state.h / 2, z: c.z } as Point };
  }
  /** How far back the camera must be to see a piece whole from a turn and tilt, with a little room around it. */
  function whole(piece: { angle: number; state: { w: number; h: number; d: number } }, az: number, el: number) {
    const room = camera.availableRoom(), view = dom.$('#view').getBoundingClientRect();
    return camera.cameraFitDistance(piece.state, az - piece.angle * Math.PI / 180, el, room.w / room.h) * (view.height / room.h) * 1.15;
  }
  /** The camera's direction from its target, and its right, up and forward axes, at a turn and tilt. */
  function frame(az: number, el: number) {
    const d = { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: Math.cos(el) * Math.cos(az) }, f = { x: -d.x, y: -d.y, z: -d.z };
    const r = { x: Math.cos(az), y: 0, z: -Math.sin(az) }, u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
    return { d, r, u, f };
  }
  const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
  /** One finger turned the view by `turn` and tilted it by `tilt` (radians). The camera and its target go round the
   * pivot together, so the piece stays where it is on screen, and the target eases onto it as the view turns. */
  function orbit(turn: number, tilt: number) {
    const s = cameraState, found = pivot(), az = s.az + turn;
    let el = Math.max(0, Math.min(1.35, s.el + tilt));
    if (!found) { s.az = az; s.el = el; return; }
    const p = found.at;
    const old = frame(s.az, s.el), c = { x: s.tgt.x + s.dist * old.d.x, y: s.tgt.y + s.dist * old.d.y, z: s.tgt.z + s.dist * old.d.z };
    const v = { x: p.x - c.x, y: p.y - c.y, z: p.z - c.z }, local = { x: dot(v, old.r), y: dot(v, old.u), z: dot(v, old.f) };
    const place = (e: number) => {
      const n = frame(az, e), cam = { x: p.x - local.x * n.r.x - local.y * n.u.x - local.z * n.f.x, y: p.y - local.x * n.r.y - local.y * n.u.y - local.z * n.f.y, z: p.z - local.x * n.r.z - local.y * n.u.z - local.z * n.f.z };
      return { cam, n };
    };
    let next = place(el);
    // Tilting round a high pivot must not take the camera under the floor: then it only turns.
    if (next.cam.y < 5) { el = s.el; next = place(el); }
    const ease = 1 - Math.exp(-3 * (Math.abs(turn) + Math.abs(el - s.el)));
    const t = { x: next.cam.x - s.dist * next.n.d.x, y: next.cam.y - s.dist * next.n.d.y, z: next.cam.z - s.dist * next.n.d.z };
    s.tgt.set(t.x + (p.x - t.x) * ease, t.y + (p.y - t.y) * ease, t.z + (p.z - t.z) * ease);
    const back = whole(found.piece, az, el);
    if (s.dist < back) s.dist += (back - s.dist) * ease;
    s.tgtY = s.tgt.y; s.az = az; s.el = el; s.panned = true;
  }
  /** A finger came or went: the next pinch zooms about what is under its fingers then. */
  const release = () => { anchor = null; };

  /** How far into the edge zone a point is on each side: 0 outside it, 1 at the edge. */
  function push(at: ScreenPoint) {
    const r = dom.$('#view').getBoundingClientRect(), bar = dom.$('#toolbar')?.getBoundingClientRect();
    const bottom = bar && bar.height > 0 && bar.top > r.top + r.height / 2 ? Math.min(r.bottom, bar.top) : r.bottom;
    const depth = (d: number) => Math.max(0, Math.min(1, 1 - d / EDGE_ZONE)) ** 2;
    return { x: depth(at.clientX - r.left) - depth(r.right - at.clientX), y: depth(at.clientY - r.top - 64) - depth(bottom - at.clientY) };
  }
  function tick(now: number) {
    if (!follow) return;
    follow.frame = null;
    if (!follow.holding()) { follow = null; return; }
    const dt = Math.min(.05, Math.max(0, (now - follow.last) / 1000)), p = push(follow.at);
    follow.last = now;
    if (dt > 0 && (p.x || p.y)) {
      camera.panBy(p.x * EDGE_SPEED * dt, p.y * EDGE_SPEED * dt);
      follow.move(follow.at);
    }
    follow.frame = lifetime.frame(tick);
  }
  /** A drag moved to `at`. While it is held near an edge of the view, the view moves on and `move` is called again
   * with the same finger, so what is dragged follows. `holding` says whether the drag is still going on. */
  function followEdge(at: ScreenPoint, move: (at: ScreenPoint) => void, holding: () => boolean) {
    if (follow) { follow.at = at; follow.move = move; follow.holding = holding; }
    else follow = { at, move, holding, frame: null, last: performance.now() };
    if (follow.frame === null) follow.frame = lifetime.frame(tick);
  }
  function stopFollowing() {
    if (follow?.frame != null) lifetime.cancelFrame(follow.frame as never);
    follow = null;
  }
  lifetime.cleanup(stopFollowing);
  return { pinch, orbit, release, followEdge, stopFollowing, push };
}
