import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRenderAssetCache } from './render-asset-cache';

/** Muted leather colours, alongside the Drape Lab clothing palette. */
export const HANDBAG_COLOURS = ['#5a4b3c', '#b4a58a', '#3a3a37', '#8a8a86', '#d9d3c4', '#4c5872'] as const;

/** Shelf bags have a shared unit-size model; scaling keeps the whole bag, including handles, within its storage unit. */
export function createHandbagRenderer() {
  const cache = createRenderAssetCache();
  function handbag(parent: THREE.Group, x: number, base: number, z: number, width: number, height: number, depth: number, color: string) {
    const bag = new THREE.Group();
    bag.name = 'handbag';
    bag.position.set(x, base, z);
    bag.scale.set(width, height, depth);
    const [leather, seam] = cache.material('leather:' + color, () => {
      const c = new THREE.Color(color).convertSRGBToLinear();
      return [
        new THREE.MeshPhysicalMaterial({ color: c, roughness: .64, metalness: 0, clearcoat: .12, clearcoatRoughness: .7, envMapIntensity: .55 }),
        new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(.72), roughness: .85, envMapIntensity: .4 }),
      ];
    });
    const [metal] = cache.material('hardware', () => [new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b8a078').convertSRGBToLinear(), roughness: .4, metalness: .65,
    })]);
    function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material | undefined) {
      const part = new THREE.Mesh(geometry, material);
      part.name = name;
      part.castShadow = part.receiveShadow = true;
      bag.add(part);
      cache.meshes.add(part);
      return part;
    }
    // Merge all parts of each material: a detailed bag needs only three draw calls.
    function merge(parts: THREE.BufferGeometry[]) {
      const normalized = parts.map(part => part.index ? part.toNonIndexed() : part);
      const merged = BufferGeometryUtils.mergeBufferGeometries(normalized);
      new Set([...parts, ...normalized]).forEach(part => part.dispose());
      if (!merged) throw new Error('Unable to build handbag geometry');
      return merged;
    }
    mesh('handbag-leather', cache.geometry('leather', () => {
      const shape = new THREE.Shape();
      shape.moveTo(-.39, .02);
      shape.quadraticCurveTo(-.47, .02, -.47, .1);
      shape.lineTo(-.42, .72);
      shape.quadraticCurveTo(0, .77, .42, .72);
      shape.lineTo(.47, .1);
      shape.quadraticCurveTo(.47, .02, .39, .02);
      shape.closePath();
      const body = new THREE.ExtrudeGeometry(shape, { depth: .9, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2, steps: 1, curveSegments: 8 });
      body.translate(0, 0, -.45);
      const handle = new THREE.TubeGeometry(new THREE.CubicBezierCurve3(
        new THREE.Vector3(-.22, .7, 0), new THREE.Vector3(-.26, 1.06, 0),
        new THREE.Vector3(.26, 1.06, 0), new THREE.Vector3(.22, .7, 0),
      ), 16, .012, 5, false);
      const front = handle.clone().translate(0, 0, .36), back = handle.translate(0, 0, -.36);
      return merge([body, front, back]);
    }), leather);
    mesh('handbag-seams', cache.geometry('seams', () => {
      const piping = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-.39, .69, 0), new THREE.Vector3(-.43, .12, 0),
        new THREE.Vector3(-.35, .055, 0), new THREE.Vector3(.35, .055, 0),
        new THREE.Vector3(.43, .12, 0), new THREE.Vector3(.39, .69, 0),
      ]), 24, .004, 4, false);
      return merge([piping.clone().translate(0, 0, .474), piping.translate(0, 0, -.474)]);
    }), seam);
    mesh('handbag-hardware', cache.geometry('hardware', () => {
      const parts: THREE.BufferGeometry[] = [];
      for (const side of [-1, 1]) for (const hx of [-.22, .22]) {
        parts.push(new THREE.TorusGeometry(.025, .006, 5, 10).translate(hx, .7, side * .38));
      }
      parts.push(new THREE.BoxGeometry(.085, .025, .018).translate(0, .69, .48));
      return merge(parts);
    }), metal);
    parent.add(bag);
    return bag;
  }
  return { handbag, ...cache };
}
