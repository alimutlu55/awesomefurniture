import type * as THREE from 'three';

interface Shift { x: number; y: number; zoom: number }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How to shift and zoom the view so a design shows whole beside a sheet that covers part of it: a panel docked
 * on the left (desktop) moves the design right; a sheet along the bottom (phone) lifts it above. Pixels. Pure. */
export function stageShift(view: { width: number; height: number }, sheet: { left: number; right: number; top: number; height: number } | null): Shift {
  if (!sheet || view.width <= 0 || view.height <= 0) return { x: 0, y: 0, zoom: 1 };
  const across = sheet.right - sheet.left > view.width * .75;
  if (!across && sheet.left < view.width * .3 && sheet.right < view.width * .6) {
    const free = view.width - sheet.right;
    return { x: sheet.right / 2, y: 0, zoom: clamp(free / view.width * 1.08, .5, 1) };
  }
  if (across && sheet.top > view.height * .2) return { x: 0, y: (view.height - sheet.top) / 2, zoom: clamp(sheet.top / view.height * 1.3, .5, 1) };
  return { x: 0, y: 0, zoom: 1 };
}

/** Keeps the design in the free part of the view while a sheet lies over it, easing in and out; when nothing
 * covers the view it gives the camera back to the editor exactly as it was. */
export function createStageFraming({ resources, cameraState, applyView }: {
  resources: { readonly cv: HTMLCanvasElement }; cameraState: { readonly vs: number; readonly vz: number }; applyView(): void;
}) {
  let goal: Shift = { x: 0, y: 0, zoom: 1 }, now: Shift = { ...goal }, active = false;
  function around(rect: DOMRect | null) {
    const view = resources.cv.getBoundingClientRect();
    goal = stageShift(view, rect && { left: rect.left - view.left, right: rect.right - view.left, top: rect.top - view.top, height: rect.height });
  }
  function frame(camera: THREE.PerspectiveCamera, dt: number) {
    const k = 1 - Math.exp(-dt * 5);
    now = { x: now.x + (goal.x - now.x) * k, y: now.y + (goal.y - now.y) * k, zoom: now.zoom + (goal.zoom - now.zoom) * k };
    const rest = Math.abs(now.x) < .5 && Math.abs(now.y) < .5 && Math.abs(now.zoom - 1) < .002;
    if (rest && goal.x === 0 && goal.y === 0 && goal.zoom === 1) {
      now = { ...goal };
      if (active) { active = false; applyView(); }
      return;
    }
    active = true;
    const w = resources.cv.clientWidth, h = resources.cv.clientHeight;
    if (!w || !h) return;
    camera.setViewOffset(w, h, -(cameraState.vs + now.x), now.y, w, h);
    camera.zoom = cameraState.vz * now.zoom;
    camera.updateProjectionMatrix();
  }
  return { around, frame };
}
