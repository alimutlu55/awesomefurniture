import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { Point2 } from './frame-geometry';
let reflecting = false;

/** Actual panel outlines, including sloped tops, bound glazing, mirrors and shallow Shaker profiles. */
export function decorateFront(outline: readonly Point2[], depth: number, z: number, material: THREE.Material, parent: THREE.Object3D) {
  const style = material.userData.glassStyle as string | undefined;
  const shaker = material.userData.frontProfile === 'micro_shaker' && !style;
  if (!style && !shaker) return;
  const points = outline.map(p => new THREE.Vector2(p.x, p.y));
  if (style?.endsWith('mirror')) {
    const shape = new THREE.Shape(points);
    const mirror = new Reflector(new THREE.ShapeGeometry(shape), { color: new THREE.Color(style === 'bronze_mirror' ? 0xbca084 : 0xf0f1ef),
      textureWidth: 512, textureHeight: 1024, clipBias: .003 });
    mirror.position.z = z + depth / 2 + .01;
    mirror.userData.planarMirror = true;
    const renderReflection = mirror.onBeforeRender.bind(mirror);
    mirror.onBeforeRender = (...args) => {
      if (reflecting) return;
      reflecting = true; try { renderReflection(...args); } finally { reflecting = false; }
    };
    (mirror.material as THREE.Material).addEventListener('dispose', () => mirror.getRenderTarget().dispose());
    parent.add(mirror);
    return;
  }
  const bounds = new THREE.Box2().setFromPoints(points), size = bounds.getSize(new THREE.Vector2()), centre = bounds.getCenter(new THREE.Vector2());
  const border = Math.min(2, size.x / 5, size.y / 5);
  const inner = points.map(p => new THREE.Vector2(centre.x + (p.x - centre.x) * (1 - 2 * border / size.x),
    centre.y + (p.y - centre.y) * (1 - 2 * border / size.y)));
  const ring = new THREE.Shape(points); ring.holes.push(new THREE.Path(inner.reverse()));
  const geometry = new THREE.ExtrudeGeometry(ring, { depth: shaker ? .35 : 1.8, bevelEnabled: false });
  const frameMaterial = shaker ? material : new THREE.MeshStandardMaterial({
    color: new THREE.Color(material.userData.frameColor ?? '#242426').convertSRGBToLinear(), roughness: .4, metalness: .8 });
  const frame = new THREE.Mesh(geometry, frameMaterial);
  frame.position.z = shaker ? z + depth / 2 : z - .9;
  frame.castShadow = frame.receiveShadow = true; frame.userData.frontFrame = shaker ? 'micro_shaker' : 'aluminum_20mm';
  parent.add(frame);
}
