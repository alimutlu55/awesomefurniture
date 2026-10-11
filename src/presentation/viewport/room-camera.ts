import * as THREE from 'three';
import { wallLine } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';

type P = { x: number; z: number };
/** A wardrobe's footprint: centre, angle in degrees, width and depth. */
export interface Footprint { readonly x: number; readonly z: number; readonly angle: number; readonly state: { readonly w: number; readonly d: number } }

/** The camera's base lens (vertical field of view, degrees) and the widest it opens in a room. */
export const LENS = Object.freeze({ base: 35, widest: 76 });
/** Elevations (radians) between which the camera goes from "inside the room" to "overview from above". */
const EYE_LEVEL = .3, OVERVIEW = .55;
/** How close the camera may come to a wall's face, and how far in front of the subject a wall must be to
 * count: a wall right behind the subject (the one a wardrobe stands against) is cut away instead. */
const MARGIN = 22, BEHIND_SUBJECT = 100;
/** At eye level, the camera faces the wall the subject stands against at most this far round: cos 45°,
 * the classic three-quarter view, which also looks from the far corner of the room. */
const FACING = Math.SQRT1_2;
/** How far the camera stays from a wardrobe it is not looking at. */
const FURNITURE = 50;

/** How far (horizontally, centimetres) the camera can move from `from` along `dir` (unit) before it
 * comes within MARGIN of a wall's face; `max` if no wall is in the way. Walls closer than
 * BEHIND_SUBJECT to `from` are ignored: the camera may look through those as the cutaway lowers them. */
export function wallClearance(studio: Studio, from: P, dir: P, max: number): number {
  let best = max;
  for (const w of studio.walls) {
    const line = wallLine(studio, w);
    if (!line) continue;
    // The wall's face on the subject's side, pushed out by the margin.
    const side = (from.x - line.a.x) * line.nx + (from.z - line.a.z) * line.nz >= 0 ? 1 : -1;
    const off = side * (w.thickness / 2 + MARGIN), ax = line.a.x + line.nx * off, az = line.a.z + line.nz * off;
    const det = dir.x * -line.uz + dir.z * line.ux;
    if (Math.abs(det) < 1e-9) continue;
    const qx = ax - from.x, qz = az - from.z;
    const r = (qx * -line.uz + qz * line.ux) / det, u = (qx * -dir.z + qz * dir.x) / det;
    const reach = w.thickness / 2 + MARGIN;
    if (r > 0 && r < best && u >= -reach && u <= line.length + reach && r >= BEHIND_SUBJECT) best = r;
  }
  return best;
}

/** How far along `dir` from `from` before coming within FURNITURE of one of the wardrobes; `max` if none.
 * A wardrobe that `from` stands in (the subject) is not in the way. */
export function furnitureClearance(furniture: readonly Footprint[], from: P, dir: P, max: number): number {
  let best = max;
  for (const f of furniture) {
    const a = f.angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = from.x - f.x, dz = from.z - f.z;
    const o = { x: dx * c - dz * s, z: dx * s + dz * c }, d = { x: dir.x * c - dir.z * s, z: dir.x * s + dir.z * c };
    const hx = f.state.w / 2 + FURNITURE, hz = f.state.d / 2 + FURNITURE;
    if (Math.abs(o.x) <= hx && Math.abs(o.z) <= hz) continue;
    let enter = 0, leave = Infinity, hit = true;
    for (const [p, v, h] of [[o.x, d.x, hx], [o.z, d.z, hz]] as const) {
      if (Math.abs(v) < 1e-9) { if (Math.abs(p) > h) hit = false; continue; }
      const t0 = (-h - p) / v, t1 = (h - p) / v;
      enter = Math.max(enter, Math.min(t0, t1)); leave = Math.min(leave, Math.max(t0, t1));
    }
    if (hit && enter <= leave && enter > 0 && enter < best) best = enter;
  }
  return best;
}

/** How much of the orbit distance the camera keeps (0–1) at this elevation: all of it from above,
 * only up to the walls at eye level, blended in between. */
export function roomReach(studio: Studio, target: P, camera: P, elevation: number, furniture: readonly Footprint[] = []): number {
  const dx = camera.x - target.x, dz = camera.z - target.z, d = Math.hypot(dx, dz);
  if (d < 1) return 1;
  const dir = { x: dx / d, z: dz / d };
  const inside = Math.min(1, furnitureClearance(furniture, target, dir, wallClearance(studio, target, dir, d)) / d);
  return 1 - eyeLevel(elevation) * (1 - inside);
}

/** The lens that keeps the same framing when the camera stands `reach` (0–1) of its distance away. */
export const lensFor = (reach: number) => Math.min(LENS.widest, 2 * Math.atan(Math.tan(LENS.base * Math.PI / 360) / Math.max(.05, reach)) * 180 / Math.PI);

/** How much an elevation counts as eye level: 0 from above (overview), 1 at eye level. */
export const eyeLevel = (elevation: number) => Math.max(0, Math.min(1, (OVERVIEW - elevation) / (OVERVIEW - EYE_LEVEL)));

/** Whether the camera can stand in direction `dir` from `from` at eye level: on the room side of every
 * wall the subject stands close to (within BEHIND_SUBJECT), within 45 degrees of straight on. A person cannot
 * stand behind the wall a wardrobe is against, and from further round a wall-standing wardrobe shows
 * mostly its side. */
function roomSide(studio: Studio, from: P, dir: P) {
  for (const w of studio.walls) {
    const line = wallLine(studio, w);
    if (!line) continue;
    const across = (from.x - line.a.x) * line.nx + (from.z - line.a.z) * line.nz, along = (from.x - line.a.x) * line.ux + (from.z - line.a.z) * line.uz;
    if (Math.abs(across) >= BEHIND_SUBJECT || along < -w.thickness || along > line.length + w.thickness) continue;
    if ((dir.x * line.nx + dir.z * line.nz) * Math.sign(across || 1) < FACING) return false;
  }
  return true;
}
/** The orbit angle nearest `az` from which the camera looks at `from` from the room side. */
export function roomSideAngle(studio: Studio, from: P, az: number) {
  for (let k = 0; k <= 36; k++) for (const sign of k ? [1, -1] : [1]) {
    const a = az + sign * k * Math.PI / 36;
    if (roomSide(studio, from, { x: Math.sin(a), z: Math.cos(a) })) return a;
  }
  return az;
}

interface Orbit { az: number; readonly el: number; readonly dist: number; readonly tgt: THREE.Vector3 }

/** Each frame, in a room, places the camera like an interior photographer: from above it orbits freely
 * (the near walls are cut away); coming down to eye level its view centres on the subject (the wardrobes),
 * it does not go round behind a wall the subject stands against, and it stays inside the room, backing
 * against the far wall with a wider lens to hold the framing. Shortening is quick (never through a wall);
 * the rest eases. Returns the point to look at. Without a room the camera is left as it is. */
export function createRoomCamera() {
  let reach = 1;
  const shift = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3();
  /** `furniture`: wardrobes the camera keeps clear of (none while one is selected: those in the way step
   * aside instead, see wardrobe-occlusion.ts). `subject`: where eye-level views centre, or null to keep
   * the orbit target (a wardrobe is selected, or the view was panned by hand). At full eye level a stop
   * at the wall is written back to the orbit, so dragging back responds at once. */
  function adjust(camera: THREE.PerspectiveCamera, orbit: Orbit, studio: Studio | undefined, furniture: readonly Footprint[], subject: THREE.Vector3 | null, dt: number) {
    const ease = 1 - Math.exp(-dt * 6), eye = studio ? eyeLevel(orbit.el) : 0;
    want.set(0, 0, 0);
    if (studio && subject) want.copy(subject).sub(orbit.tgt).multiplyScalar(eye);
    shift.lerp(want, ease);
    if (shift.lengthSq() < 1e-4 && want.lengthSq() === 0) shift.set(0, 0, 0);
    look.copy(orbit.tgt).add(shift);
    let az = orbit.az;
    if (studio && eye > 0) {
      const side = roomSideAngle(studio, look, orbit.az);
      if (eye >= .999) orbit.az = az = side; else az = orbit.az + (side - orbit.az) * eye;
    }
    const c = Math.cos(orbit.el);
    camera.position.set(look.x + orbit.dist * c * Math.sin(az), look.y + orbit.dist * Math.sin(orbit.el), look.z + orbit.dist * c * Math.cos(az));
    const goal = studio ? roomReach(studio, look, camera.position, orbit.el, furniture) : 1;
    reach += (goal - reach) * (1 - Math.exp(-dt * (goal < reach ? 30 : 7)));
    if (Math.abs(reach - goal) < 1e-3) reach = goal;
    if (reach < 1) camera.position.sub(look).multiplyScalar(reach).add(look);
    const fov = lensFor(reach);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    return look;
  }
  return { adjust };
}
