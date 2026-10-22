import * as THREE from 'three';
import { createRenderAssetCache } from './render-asset-cache';
import { createGarmentMaterials } from './garment-materials';
import { GARMENT_COLOURS } from './fabric';
import { DRAPE, FABRICS, TAU } from './garment-types';

/** Trousers folded over a rack rod: two tapered, flattened legs and a rounded fold across the top. */
export function buildTrouserGeometry(width: number, drop: number) {
  const position: number[] = [], uv: number[] = [], color: number[] = [];
  const indices: [number[], number[]] = [[], []];
  const upper = Math.min(7, drop * .14);
  function patch(surface: (u: number, v: number) => [number, number, number], nu: number, nv: number, group: 0 | 1) {
    const base = position.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const [x, y, z] = surface(i / nu, j / nv);
      position.push(x, y, z);
      uv.push(x / 100 * FABRICS.wool.us, y / 100 * FABRICS.wool.us);
      const ao = .94 - .12 * Math.min(1, -y / drop);
      color.push(ao, ao, ao);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1;
      indices[group].push(a, c, b, b, c, c + 1);
    }
  }
  const leg = (side: number, theta: number, v: number, offset = 0): [number, number, number] => {
    const radius = width * (.22 - .055 * v);
    const x = side * width * (.25 + .015 * v) + (radius + offset) * Math.cos(theta);
    const y = -upper - (drop - upper) * v;
    // Pressed crease and soft longitudinal folds; the flattened tube gives cloth thickness without a box silhouette.
    const fold = .16 * Math.sin(theta * 3 + v * 1.3) + .07 * Math.sin(v * 9 + side);
    const z = (.85 + offset + fold * Math.sin(Math.PI * v)) * Math.sin(theta);
    return [x, y, z];
  };
  for (const side of [-1, 1]) {
    patch((u, v) => leg(side, u * TAU, v), 20, 26, 0);
    patch((u, v) => leg(side, u * TAU, .968 + .032 * v, .035), 20, 2, 1);
    for (const theta of [0, Math.PI]) patch((u, v) => leg(side, theta + (u - .5) * .035, v, .025), 1, 26, 1);
  }
  for (const side of [-1, 1]) patch((u, v) => [
    (u - .5) * width * .94, -upper * v, side * (.85 + .09 * Math.sin(u * TAU * 3) * v),
  ], 20, 6, 0);
  patch((u, v) => [(u - .5) * width * .94, .85 * Math.sin(v * Math.PI), .85 * Math.cos(v * Math.PI)], 20, 8, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geometry.setIndex(indices[0].concat(indices[1]));
  geometry.addGroup(0, indices[0].length, 0);
  geometry.addGroup(indices[0].length, indices[1].length, 1);
  geometry.computeVertexNormals();
  return geometry;
}

/** A sliding metal rack with individually draped trousers. All dimensions are centimetres. */
export function createTrouserRenderer(document?: Document) {
  const cache = createRenderAssetCache();
  function trouserPullOut(parent: THREE.Group, cx: number, top: number, z: number, width: number, depth: number, drop: number, count: number,
    finish: import('../../domain/materials/configured-materials').AccessoryFinish = 'brushed_steel') {
    const rack = new THREE.Group();
    rack.name = 'trouser-pull-out';
    rack.position.set(cx, top, z);
    const color = { brushed_steel: '#b4b8bd', matte_black: '#242426', anodized_champagne: '#c2b69c' }[finish];
    const [steel, dark] = cache.material('rack:' + finish, () => [
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), roughness: .4, metalness: .6 }),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#403b36').convertSRGBToLinear(), roughness: .75 }),
    ]);
    const cube = cache.geometry('rack-box', () => new THREE.BoxGeometry(1, 1, 1));
    const cylinder = cache.geometry('rack-rod', () => new THREE.CylinderGeometry(.6, .6, 1, 10));
    const cap = cache.geometry('rod-cap', () => new THREE.SphereGeometry(.85, 8, 6));
    function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[] | undefined) {
      const part = new THREE.Mesh(geometry, material);
      part.name = name;
      part.castShadow = part.receiveShadow = true;
      rack.add(part); cache.meshes.add(part);
      return part;
    }
    for (const side of [-1, 1]) {
      const runner = mesh('slide-runner', cube, steel);
      runner.scale.set(1.2, 2.2, depth);
      runner.position.set(side * (width / 2 - 2), 0, 0);
      const slide = mesh('slide-track', cube, dark);
      slide.scale.set(.45, .65, depth * .82);
      slide.position.set(side * (width / 2 - 2.7), 0, 0);
    }
    for (const side of [-1, 1]) {
      const crossbar = mesh(side > 0 ? 'front-pull' : 'rear-crossbar', cylinder, steel);
      crossbar.scale.y = width - 4;
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.set(0, -.3, side * depth / 2);
    }
    const clothWidth = Math.min(28, depth - 4), turn = DRAPE.turn * Math.PI / 180;
    const shape = cache.geometry(JSON.stringify(['trousers', clothWidth, drop]), () => buildTrouserGeometry(clothWidth, drop));
    for (let j = 0; j < count; j++) {
      const x = -(count - 1) * 3 + j * 6;
      const rod = mesh('trouser-rod', cylinder, steel);
      rod.scale.y = clothWidth + 4;
      rod.rotation.set(0, turn, Math.PI / 2);
      rod.position.set(x, -2, 0);
      for (const side of [-1, 1]) {
        const end = mesh('rod-end-cap', cap, dark);
        end.position.set(x + side * (clothWidth / 2 + 2) * Math.cos(turn), -2, -side * (clothWidth / 2 + 2) * Math.sin(turn));
      }
      const hex = GARMENT_COLOURS[j % GARMENT_COLOURS.length]!;
      const materials = cache.material(hex, () => {
        const [cloth, seam, trim] = createGarmentMaterials('wool', new THREE.Color(hex).convertSRGBToLinear(), document);
        trim.dispose();
        return [cloth, seam];
      });
      const trousers = mesh('folded-trousers', shape, materials);
      trousers.position.set(x, -2, 0);
      trousers.rotation.y = turn;
    }
    parent.add(rack);
    return rack;
  }
  return { trouserPullOut, ...cache };
}
