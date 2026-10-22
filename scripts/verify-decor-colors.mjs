import * as THREE from 'three';
import { decorCatalog } from '../src/domain/materials/decor-catalog.ts';
import { createDecorMaterial } from '../src/presentation/viewport/cabinet-materials.ts';
import { createDecorTextureLoader } from '../src/presentation/viewport/decor-textures.ts';
import { createSceneLighting } from '../src/presentation/viewport/scene-lighting.ts';
import { boardUVs } from '../src/presentation/viewport/board-geometry.ts';

/** Real GPU check: compare each lit board with the same manufacturer's sRGB swatch at several camera exposures. */
export async function verifyDecorColors() {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true, antialias: false });
  renderer.setSize(256, 256); renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), lighting = createSceneLighting(renderer, scene);
  lighting.fit({ x: 0, z: 0, w: 150, d: 18, h: 150 });
  const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1000);
  camera.position.set(0, 75, 500); camera.lookAt(0, 75, 0);
  const M = (color, options) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), ...options });
  const loadTexture = createDecorTextureLoader(document);
  const geometry = new THREE.PlaneGeometry(150, 150), mesh = new THREE.Mesh(geometry);
  mesh.position.y = 75; scene.add(mesh);
  const read = material => {
    mesh.material = material; renderer.render(scene, camera);
    const pixel = new Uint8Array(4), gl = renderer.getContext();
    gl.readPixels(128, 128, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return Array.from(pixel).slice(0, 3);
  };
  const results = [];
  try {
    for (const sku of decorCatalog) {
      let loaded, textureReady;
      const ready = new Promise(resolve => { textureReady = resolve; });
      const material = createDecorMaterial({ M, decorTexture: (url, callback) => loadTexture(url, texture => {
        callback(texture); loaded = texture; textureReady();
      }) }, sku);
      if (sku.pbr.textureUrl) await ready;
      boardUVs(geometry, 0, sku.grainDirection, material.userData.boardMapping);
      const image = new Image(); image.src = sku.pbr.swatchUrl ?? sku.pbr.textureUrl;
      await image.decode();
      const source = document.createElement('canvas'); source.width = image.naturalWidth; source.height = image.naturalHeight;
      const context = source.getContext('2d'); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, source.width, source.height).data, sum = [0, 0, 0];
      for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += pixels[i + c];
      const mean = sum.map(value => Math.round(value / (pixels.length / 4)));
      const fallback = sku.pbr.baseHex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16));
      if (!mean.every((value, c) => Math.abs(value - fallback[c]) <= 1)) throw new Error(`${sku.id}: fallback differs from manufacturer sample: ${mean} vs ${fallback}`);
      const reference = new THREE.MeshBasicMaterial({ color: loaded ? 0xffffff : new THREE.Color(sku.pbr.baseHex).convertSRGBToLinear(),
        map: loaded ?? null, toneMapped: false });
      const expected = read(reference), measurements = [];
      for (const exposure of [.6, 1.2, 1.8]) {
        renderer.toneMappingExposure = exposure;
        const actual = read(material), error = Math.max(...actual.map((value, c) => Math.abs(value - expected[c])));
        if (error > 4) throw new Error(`${sku.id}: lit board differs from swatch by ${error}: ${actual} vs ${expected}`);
        measurements.push({ exposure, actual, error });
      }
      results.push({ id: sku.id, expected, measurements });
      material.dispose(); reference.dispose();
    }
    return results;
  } finally {
    geometry.dispose(); lighting.dispose(); renderer.dispose(); renderer.forceContextLoss();
  }
}
