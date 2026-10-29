import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import oakNormal from '../viewport/textures/oak_veneer_02_nor_gl.webp';
import oakRoughness from '../viewport/textures/oak_veneer_02_rough.webp';
import type { StudyFinish } from './study';
import type { AssemblyPart } from './assembly-model';

export function assemblyMaterials(renderer: THREE.WebGLRenderer, changed: () => void) {
  const textures: THREE.Texture[] = [], loader = new THREE.TextureLoader();
  const load = (url: string, color = false) => {
    const texture = loader.load(url, changed, undefined, changed);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (color) texture.encoding = THREE.sRGBEncoding;
    textures.push(texture); return texture;
  };
  const wood = new THREE.MeshStandardMaterial({ map: load('/textures/decors/egger-h1318-st10.webp', true), normalMap: load(oakNormal),
    roughnessMap: load(oakRoughness), normalScale: new THREE.Vector2(.12, .12), roughness: .8, envMapIntensity: .4 });
  const metal = new THREE.MeshStandardMaterial({ color: '#a6aaa7', metalness: .95, roughness: .24, envMapIntensity: 1.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#383a34', metalness: .72, roughness: .34 });
  const line = new THREE.LineBasicMaterial({ color: '#657063', transparent: true, opacity: .65 });
  const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = generator.fromScene(room, .04);
  room.traverse(object => {
    if (object instanceof THREE.Mesh) { object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); }
  });
  generator.dispose();
  let previousFinish = '', previousDrawing = false;
  return {
    wood, metal, dark, line, environment: environment.texture,
    finish(finish: StudyFinish, drawing: boolean) {
      if (previousFinish === finish && previousDrawing === drawing) return;
      previousFinish = finish; previousDrawing = drawing;
      wood.color.set(drawing ? '#eeeae0' : finish === 'smoked' ? '#8b7564' : finish === 'chalk' ? '#e6e4dc' : '#ebe5d9').convertSRGBToLinear();
      wood.map = drawing || finish === 'chalk' ? null : textures[0]!;
      wood.normalScale.setScalar(drawing || finish === 'chalk' ? .025 : .12);
      wood.roughness = finish === 'chalk' ? .92 : .8;
      wood.needsUpdate = true;
    },
    dispose() { for (const texture of textures) texture.dispose();
      wood.dispose(); metal.dispose(); dark.dispose(); line.dispose(); environment.dispose(); },
  };
}

/** Metre-scaled grain follows the long axis of each board, including its thin finished edges. */
export function panelGeometry(part: AssemblyPart): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  if (part.outline) {
    const shape = new THREE.Shape(part.outline.map(([x, y]) => new THREE.Vector2(x, y)));
    geometry = new THREE.ExtrudeGeometry(shape, { depth: part.size[2], bevelEnabled: true,
      bevelSize: .001, bevelThickness: .001, bevelSegments: 1, steps: 1 });
    geometry.translate(0, 0, -part.size[2] / 2);
  } else geometry = new RoundedBoxGeometry(...part.size, 1, .0015);
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  const vertical = part.size[1] > part.size[0];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const side = Math.abs(normals.getX(i)) > .8, top = Math.abs(normals.getY(i)) > .8;
    const u = vertical ? y : x, v = top ? z : side ? z : vertical ? x : y;
    const offset = (part.position[0] * .31 + part.position[1] * .17) % 1;
    uv.setXY(i, u / 2.311 + .37 + offset, v / 1.3 + .28 + offset * .4);
  }
  return geometry;
}
