import * as THREE from 'three';
import type { LightSetting } from './scene-lighting';
import { MIDDAY_LIGHT } from './scene-lighting';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { isKitchen } from '../../domain/furniture/furniture';
import type { EditorCabinet } from '../../application/projects/editor-scene';

/** A time of day: the room's light, how much the surroundings light the surfaces (`env`) and how bright glowing
 * glass is (`emissive`), and whether the wardrobes' own lights are on. */
export interface TimeOfDay {
  readonly id: string; readonly name: string; readonly hint: string;
  readonly light: LightSetting; readonly env: number; readonly emissive: number; readonly lamps: boolean;
}

/** The times of day, in the order of the day. The first is the editor's own light. */
export const TIMES_OF_DAY = [
  { id: 'midday', name: 'Midday', hint: 'Soft daylight, true colours', light: MIDDAY_LIGHT, env: 1, emissive: 1, lamps: false },
  {
    id: 'morning', name: 'Morning', hint: 'Cool, clear light from the left', env: .95, emissive: 1, lamps: false,
    light: { direction: [-2.8, 1.45, 1.5], sun: [0xfff6ec, 1.25], sky: [0xe7efff, 0x6d6658, .26], fill: [0xd6e2ff, .32], ambient: [0xf2f6ff, .07] },
  },
  {
    id: 'golden', name: 'Sunset', hint: 'Low, warm sun and long shadows', env: .62, emissive: .8, lamps: false,
    light: { direction: [2.6, .78, 1.9], sun: [0xffa860, 1.75], sky: [0xffd2a6, 0x51372a, .24], fill: [0x8592cc, .16], ambient: [0xffe2c8, .05] },
  },
  {
    id: 'night', name: 'Night', hint: 'Lights on inside the wardrobe', env: .1, emissive: .06, lamps: true,
    light: { direction: [1.2, 2.4, 1.4], sun: [0x9fb6ff, .14], sky: [0x334674, 0x0f0c0a, .16], fill: [0x51618f, .05], ambient: [0x1c2442, .05] },
  },
] as const satisfies readonly TimeOfDay[];
export type TimeOfDayId = typeof TIMES_OF_DAY[number]['id'];
export const timeOfDay = (id: string): TimeOfDay => (TIMES_OF_DAY as readonly TimeOfDay[]).find(t => t.id === id) ?? TIMES_OF_DAY[0];

/** Where a wardrobe's lights go: one warm strip under the top of each section, at the front. Centimetres, in the
 * wardrobe's own frame (x across from its middle, y up from its foot, z out from its middle). Pure. */
export function lampSpots(cabinet: Pick<EditorCabinet, 'state'>): { x: number; y: number; z: number; width: number }[] {
  const state = cabinet.state;
  if (isKitchen(state)) return [];
  const geometry = createWardrobeGeometry(() => state), widths: number[] = geometry.widths(), { origins } = geometry.shapeInfo();
  return widths.map((width, i) => {
    const top = geometry.interiorFloor() + geometry.ceilingIn(i, 0, width);
    return { x: -state.w / 2 + (origins[i] ?? 0) + width / 2, y: top - 1.2, z: state.d / 2 - 5, width: Math.max(10, width - 6) };
  }).filter(s => Number.isFinite(s.y) && s.y > 20);
}

const MAX_LAMPS = 6;
/** The wardrobes' own lights at night: a glowing strip in each section and a warm light falling from it. */
export function createWardrobeLamps(scene: THREE.Scene) {
  const group = new THREE.Group(), strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2b0), toneMapped: false });
  group.name = 'wardrobe-lamps';
  scene.add(group);
  let key = '';
  function clear() {
    for (const o of [...group.children]) {
      o.parent?.remove(o);
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    }
  }
  /** Lights the wardrobes, or puts the lights out. Cheap when nothing changed. */
  function sync(cabinets: readonly EditorCabinet[], on: boolean) {
    const next = on ? JSON.stringify(cabinets.map(c => [c.x, c.y ?? 0, c.z, c.angle, c.state.w, c.state.h, c.state.d, c.state.shape ?? null, c.state.secs?.length])) : '';
    if (next === key) return;
    key = next;
    clear();
    if (!on) return;
    const spots = cabinets.flatMap(c => lampSpots(c).map(s => ({ c, s }))), share = Math.max(1, Math.ceil(spots.length / MAX_LAMPS));
    spots.forEach(({ c, s }, k) => {
      const turn = c.angle * Math.PI / 180, local = new THREE.Vector3(s.x, s.y, s.z).applyAxisAngle(THREE.Object3D.DefaultUp, turn);
      const at = new THREE.Vector3(c.x, c.y ?? 0, c.z).add(local);
      const led = new THREE.Mesh(new THREE.BoxGeometry(s.width, .7, 1.4), strip);
      led.position.copy(at);
      led.rotation.y = turn;
      led.raycast = () => {};
      group.add(led);
      // Light is costly: wide wardrobes share their lights between neighbouring sections.
      if (k % share) return;
      const lamp = new THREE.SpotLight(new THREE.Color(0xffc98a).convertSRGBToLinear(), 1.9, s.y * 1.9, 1.15, .95, 1.4);
      lamp.position.copy(at);
      lamp.target.position.copy(at).add(new THREE.Vector3(0, -s.y, 14).applyAxisAngle(THREE.Object3D.DefaultUp, turn));
      group.add(lamp, lamp.target);
    });
  }
  return { sync, hide: (hidden: boolean) => { group.visible = !hidden; }, dispose() { clear(); scene.remove(group); strip.dispose(); } };
}
