import type { Vector3 } from 'three';

type ScreenPoint = { clientX: number; clientY: number };
interface TouchCameraPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>,
    'panBy' | 'cameraZoomPoint' | 'cameraZoomDistance' | 'cameraDistance'>>;
  readonly cameraState: { dist: number; panned?: boolean };
  /** The editor lifetime's frames (editor-lifetime.js), so a view following a drag stops with the editor. */
  readonly lifetime: { frame(fn: (now: number) => void): unknown; cancelFrame(id: never): void; cleanup(fn: () => void): void };
}

/** How close to the edge of the view a dragging finger starts moving the view, and how fast at the very edge. */
export const EDGE_ZONE = 48, EDGE_SPEED = 720;

/**
 * The camera under a person's fingers on a touch screen.
 * - A pinch zooms about what is between the fingers: that point stays under them, as on a map.
 * - A drag held near the edge of the view moves the view on, so a piece can be taken further than the screen shows.
 */
export function createTouchCamera({ dom, camera, cameraState, lifetime }: TouchCameraPorts) {
  /** The point being zoomed about, chosen once per pinch: what was under the fingers when it began. */
  let anchor: Vector3 | null = null;
  let follow: { at: ScreenPoint; move(at: ScreenPoint): void; holding(): boolean; frame: unknown; last: number } | null = null;

  /** Two fingers moved from `before` to `now`: they pan the view together and zoom it about the point between them. */
  function pinch(before: readonly [ScreenPoint, ScreenPoint], now: readonly [ScreenPoint, ScreenPoint]) {
    const mid = (p: readonly [ScreenPoint, ScreenPoint]) => ({ clientX: (p[0].clientX + p[1].clientX) / 2, clientY: (p[0].clientY + p[1].clientY) / 2 });
    const span = (p: readonly [ScreenPoint, ScreenPoint]) => Math.hypot(p[0].clientX - p[1].clientX, p[0].clientY - p[1].clientY);
    const from = mid(before), to = mid(now);
    anchor ??= camera.cameraZoomPoint(from);
    camera.panBy(to.clientX - from.clientX, to.clientY - from.clientY);
    if (span(now) > 0 && span(before) > 0) camera.cameraZoomDistance(camera.cameraDistance(cameraState.dist * span(before) / span(now)), anchor);
    cameraState.panned = true;
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
  return { pinch, release, followEdge, stopFollowing, push };
}
