import * as THREE from 'three';

/** Photographed CC0 oak, graded and filtered offline by scripts/prepare-wood-textures.py.
 * Browser work is limited to image decoding/upload; no 2K pixel readback or colour-grading loops.
 * Each editor owns its textures; decoded images are shared within its document. */
export const VENEER_TILE = 100, PLANK_TILE_CM = 120;

type Kind = 'veneer' | 'planks';
type MapName = 'diff' | 'rough' | 'nor_gl';
// Literal URLs let Vite fingerprint assets and share the HTML preloads' cache entries.
const ASSET: Record<Kind, Record<MapName, string>> = {
  veneer: {
    diff: new URL('./textures/oak_veneer_02_diff.webp', import.meta.url).href,
    rough: new URL('./textures/oak_veneer_02_rough.webp', import.meta.url).href,
    nor_gl: new URL('./textures/oak_veneer_02_nor_gl.webp', import.meta.url).href,
  },
  planks: {
    diff: new URL('./textures/oak_wood_planks_diff.webp', import.meta.url).href,
    rough: new URL('./textures/oak_wood_planks_rough.webp', import.meta.url).href,
    nor_gl: new URL('./textures/oak_wood_planks_nor_gl.webp', import.meta.url).href,
  },
};
interface ImageAsset { source: HTMLImageElement | null; ready: Promise<HTMLImageElement | null> }
const documents = new WeakMap<Document, Map<string, ImageAsset>>();

function image(document: Document, kind: Kind, map: MapName): ImageAsset {
  let images = documents.get(document);
  if (!images) { images = new Map(); documents.set(document, images); }
  const key = kind + ':' + map;
  let asset = images.get(key);
  if (!asset) {
    const loaded: ImageAsset = { source: null, ready: Promise.resolve(null) };
    loaded.ready = new Promise<HTMLImageElement | null>(resolve => {
      const view = document.defaultView;
      if (!view || typeof view.Image !== 'function') { resolve(null); return; }
      const img = new view.Image();
      img.decoding = 'async';
      img.onload = () => { loaded.source = img; resolve(img); };
      img.onerror = () => resolve(null);
      img.src = ASSET[kind][map];
    });
    images.set(key, loaded);
    asset = loaded;
  }
  return asset;
}

/** Overlap texture downloads with identity/session restoration, before the renderer is mounted. */
export function preloadOakTextures(document: Document): void {
  for (const kind of ['veneer', 'planks'] as const) {
    for (const map of ['diff', 'rough', 'nor_gl'] as const) void image(document, kind, map);
  }
}

function placeholder(document: Document, colour: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const g = canvas.getContext('2d');
  if (g) { g.fillStyle = colour; g.fillRect(0, 0, 1, 1); }
  return canvas;
}

export interface OakMaps { readonly map: THREE.Texture; readonly roughnessMap: THREE.Texture; readonly normalMap: THREE.Texture }

/** A fresh set of textures for one material (each owner disposes its own), sharing the page's images.
 * Repeat wrapping; one texture unit is one tile, so geometry UVs in tiles give the true scale. */
export function oakMaps(document: Document, kind: Kind, anisotropy = 8): OakMaps {
  const make = (map: MapName) => {
    // Until its image arrives, a texture is one neutral pixel: white colour, full roughness (the material's
    // own value), a flat normal. An empty texture would sample black.
    const asset = image(document, kind, map);
    const texture = new THREE.Texture(asset.source ?? placeholder(document, map === 'nor_gl' ? '#8080ff' : '#ffffff'));
    texture.needsUpdate = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    if (map === 'diff') texture.encoding = THREE.sRGBEncoding;
    let disposed = false;
    texture.addEventListener('dispose', () => { disposed = true; });
    void asset.ready.then(source => {
      if (!source || disposed || texture.image === source) return;
      texture.image = source;
      texture.needsUpdate = true;
    });
    return texture;
  };
  return { map: make('diff'), roughnessMap: make('rough'), normalMap: make('nor_gl') };
}
