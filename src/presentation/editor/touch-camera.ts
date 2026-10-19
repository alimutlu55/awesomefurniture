import type { Vector3 } from 'three';

type ScreenPoint = { clientX: number; clientY: number };
interface TouchCameraPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>,
    'panBy' | 'cameraZoomPoint' | 'cameraZoomDistance' | 'cameraDistance' | 'zoomOutTo'>>;
  readonly cameraState: { az: number; el: number; dist: number; tgt: Vector3; tgtY: number; panned?: boolean };
  /** The surface the view looks at: what a turn goes around (scene-picking.js). */
  readonly picking: Readonly<Pick<ReturnType<typeof import('./scene-picking.js').createScenePicking>, 'surfaceAlong'>>;
  /** The editor lifetime's frames (editor-lifetime.js), so a view following a drag stops with the editor. */
  readonly lifetime: { frame(fn: (now: number) => void): unknown; cancelFrame(id: never): void; cleanup(fn: () => void): void };
}

/** How close to the edge of the view a dragging finger starts moving the view, and how fast at the very edge. */
export const EDGE_ZONE = 48, EDGE_SPEED = 720;
/** How far a finger turns the view (radians per pixel: about a quarter turn across a phone); how far it moves before
 * the swipe's direction is read; and how far it then strays across a locked direction before turning freely. */
export const TURN_RATE = .0045, LOCK_AFTER = 12, UNLOCK_AFTER = 40;

/**
 * The camera under a person's fingers on a touch screen.
 * - Spreading the fingers zooms in about what is between them: that point stays under them, as on a map. Pinching
 *   them together zooms out toward the middle of the studio, so zooming out always ends on all of it.
 * - One finger turns the view around what is in the middle of it (a wall, the floor, a piece of furniture), and only
 *   turns it: no zoom, no slide. A mostly sideways swipe only turns, a mostly upright one only tilts.
 * - A drag held near the edge of the view moves the view on, so a piece can be taken further than the screen shows.
 */
export function createTouchCamera({ dom, camera, cameraState, lifetime, picking }: TouchCameraPorts) {
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
  /** The swipe turning the view: how far it has gone each way, and the direction it keeps to. */
  let swipe: { x: number; y: number; lock: 'turn' | 'tilt' | 'free' | null; stray: number } | null = null;
  /** A swipe begins: the view now turns around the surface in the middle of it. The camera stays where it is, so
   * nothing on screen moves; only the point it turns around comes to rest on what is seen there. */
  function settleOnSurface() {
    const s = cameraState, d = { x: Math.cos(s.el) * Math.sin(s.az), y: Math.sin(s.el), z: Math.cos(s.el) * Math.cos(s.az) };
    const eye = { x: s.tgt.x + s.dist * d.x, y: s.tgt.y + s.dist * d.y, z: s.tgt.z + s.dist * d.z };
    const at = picking.surfaceAlong(eye, s.tgt, s.dist * 3);
    const along = at && (at.x - eye.x) * -d.x + (at.y - eye.y) * -d.y + (at.z - eye.z) * -d.z;
    if (!at || !along || along < 20) return;
    s.tgt.set(eye.x - d.x * along, eye.y - d.y * along, eye.z - d.z * along); s.tgtY = s.tgt.y; s.dist = along; s.panned = true;
  }
  /** One finger moved by `dx`, `dy` pixels. Its first few pixels say whether the swipe turns, tilts or both; a turning
   * swipe that then strays far up or down starts tilting too (and the other way round). */
  function turn(dx: number, dy: number) {
    if (!swipe) { swipe = { x: 0, y: 0, lock: null, stray: 0 }; settleOnSurface(); }
    swipe.x += Math.abs(dx); swipe.y += Math.abs(dy);
    if (!swipe.lock && Math.hypot(swipe.x, swipe.y) >= LOCK_AFTER) swipe.lock = swipe.x >= 2 * swipe.y ? 'turn' : swipe.y >= 2 * swipe.x ? 'tilt' : 'free';
    // Until the direction is known the view holds still, so a sideways swipe never starts with a tilt.
    if (!swipe.lock) return;
    if (swipe.lock === 'turn' || swipe.lock === 'tilt') {
      swipe.stray += Math.abs(swipe.lock === 'turn' ? dy : dx);
      if (swipe.stray > UNLOCK_AFTER) swipe.lock = 'free';
    }
    const s = cameraState;
    if (swipe.lock !== 'tilt') s.az -= dx * TURN_RATE;
    if (swipe.lock !== 'turn') s.el = Math.max(0, Math.min(1.35, s.el + dy * TURN_RATE));
  }
  /** A finger came or went: the next pinch zooms about what is under its fingers then. */
  const release = () => { anchor = null; swipe = null; };

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
  return { pinch, turn, release, followEdge, stopFollowing, push };
}
