import * as THREE from 'three';
import type { BoardDecorSKU } from '../../domain/materials/decor-catalog';

/** Microgeometry only: manufacturer images supply the albedo; these maps model surface relief. */
export function applyMaterialRelief(material: THREE.MeshStandardMaterial, sku: BoardDecorSKU) {
  const kind = sku.pbr.relief;
  if (!kind) return;
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const random = noise - Math.floor(noise);
    const height = kind === 'fluted' ? .5 + .48 * Math.cos(u * Math.PI * 2)
      : kind === 'weave' ? .5 + .22 * Math.sin(u * Math.PI * 16) * Math.cos(v * Math.PI * 16)
      : kind === 'leather' ? .4 + .3 * random
      : kind === 'brushed' ? .5 + .18 * Math.sin(v * 700) + .05 * random
      : .5 + .2 * Math.sin(v * 80 + Math.sin(u * 10)) + .05 * random;
    const i = (y * size + x) * 4, value = Math.round(height * 255);
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  const [w, h] = sku.pbr.textureSizeCm ?? [231.1, 130], scale = kind === 'fluted' ? 1 : kind === 'pores' ? .2 : 1.5;
  texture.repeat.set(w * scale, h * scale);
  material.bumpMap = texture; material.bumpScale = kind === 'fluted' ? .12 : kind === 'pores' ? .015 : .008;
  material.addEventListener('dispose', () => texture.dispose());
}
