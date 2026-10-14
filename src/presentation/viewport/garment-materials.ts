import * as THREE from 'three';
import { mulberry32, TAU, type FabricKey, FABRICS, DRAPE } from './garment-shape';

export interface WeaveTextures {
  normal: THREE.Texture;
  grain: THREE.Texture;
}

let cachedTextures: { twill: WeaveTextures; knit: WeaveTextures } | null = null;

/** Generates procedural normal and grain canvas textures for woven cloth (twill and knit). */
export function getWeaveTextures(document?: Document): { twill: WeaveTextures; knit: WeaveTextures } {
  if (cachedTextures) return cachedTextures;
  const doc = document ?? (typeof window !== 'undefined' ? window.document : undefined);
  if (!doc || typeof doc.createElement !== 'function') {
    const dummy = () => {
      const t = new THREE.Texture();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    cachedTextures = {
      twill: { normal: dummy(), grain: dummy() },
      knit: { normal: dummy(), grain: dummy() },
    };
    return cachedTextures;
  }
  const validDoc = doc;

  function makeTextures(heightAt: (x: number, y: number, rnd: () => number) => number, strength: number): WeaveTextures {
    const N = 128, h = new Float32Array(N * N), rnd = mulberry32(99);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = heightAt(x, y, rnd);
    const nc = validDoc.createElement('canvas'), gc = validDoc.createElement('canvas');
    nc.width = nc.height = gc.width = gc.height = N;
    const nctx = nc.getContext('2d'), gctx = gc.getContext('2d');
    if (!nctx || !gctx) {
      const t = new THREE.Texture();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return { normal: t, grain: t };
    }
    const nimg = nctx.createImageData(N, N), gimg = gctx.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const l = h[y * N + ((x - 1 + N) % N)]!, r = h[y * N + ((x + 1) % N)]!;
        const u = h[((y - 1 + N) % N) * N + x]!, d = h[((y + 1) % N) * N + x]!;
        const nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
        const len = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
        nimg.data[i] = (nx / len * 0.5 + 0.5) * 255;
        nimg.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
        nimg.data[i + 2] = (nz / len * 0.5 + 0.5) * 255;
        nimg.data[i + 3] = 255;
        const g = 205 + h[y * N + x]! * 50;
        gimg.data[i] = gimg.data[i + 1] = gimg.data[i + 2] = g;
        gimg.data[i + 3] = 255;
      }
    }
    nctx.putImageData(nimg, 0, 0);
    gctx.putImageData(gimg, 0, 0);
    const normal = new THREE.CanvasTexture(nc), grain = new THREE.CanvasTexture(gc);
    const tile = (DRAPE.pitch * 16) / 1000; // tile size in metres (e.g. 0.032 m for 2 mm pitch)
    const rep = 1 / tile;
    [normal, grain].forEach(t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rep, rep);
      t.anisotropy = 4;
    });
    grain.encoding = THREE.sRGBEncoding;
    return { normal, grain };
  }

  const twill = makeTextures((x, y, rnd) => {
    const ridge = 0.5 + 0.5 * Math.sin(((x + y) / 8) * TAU);
    const thread = 0.5 + 0.5 * Math.sin((x / 4) * TAU + Math.sin((y / 8) * TAU) * 0.8);
    return ridge * 0.65 + thread * 0.2 + rnd() * 0.15;
  }, 2.2);

  const knit = makeTextures((x, y, rnd) => {
    const a = Math.abs((x % 8) - 3.5), b = y % 8;
    const d = Math.abs(a - 0.5 * b);
    return Math.max(0, 1 - d / 1.3) * 0.9 + rnd() * 0.12;
  }, 3);

  cachedTextures = { twill, knit };
  return cachedTextures;
}

/** Creates the 3 materials for a garment: 0 = cloth, 1 = details, 2 = buttons. */
export function createGarmentMaterials(
  fabKey: FabricKey,
  color: THREE.Color,
  document?: Document,
): [THREE.Material, THREE.Material, THREE.Material] {
  const fab = FABRICS[fabKey];
  const textures = getWeaveTextures(document);
  const tex = fab.knit ? textures.knit : textures.twill;
  const c = color.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);

  const sheenColor = c.clone().lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(fab.sheen);
  const base = new THREE.MeshPhysicalMaterial({
    color: c,
    roughness: fab.rough,
    metalness: 0,
    sheen: sheenColor,
    normalMap: tex.normal,
    normalScale: new THREE.Vector2(fab.ns, fab.ns),
    map: tex.grain,
    vertexColors: true,
    side: THREE.DoubleSide,
    envMapIntensity: 0.55,
  });

  const detail = base.clone();
  detail.color.setHSL(hsl.h, hsl.s, hsl.l < 0.3 ? hsl.l + 0.07 : hsl.l * 0.8);

  const trim = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hsl.l > 0.45 ? 0x403b36 : 0xe8e2d2).convertSRGBToLinear(),
    roughness: 0.35,
    metalness: 0,
    vertexColors: true,
    side: THREE.DoubleSide,
    envMapIntensity: 0.7,
  });

  return [base, detail, trim];
}

/** Shared hardware materials for wooden hanger arms and steel hook. */
export function createHangerMaterials(resources?: { M?: (color: string, opt?: object) => THREE.Material }) {
  const M = resources?.M ?? ((c: string, opt?: object) => new THREE.MeshStandardMaterial({ color: c, ...opt }));
  const wood = M('#c9a878', { roughness: 0.6 });
  const steel = M('#b4b8bd', { metalness: 0.6, roughness: 0.4 });
  return { wood, steel };
}
