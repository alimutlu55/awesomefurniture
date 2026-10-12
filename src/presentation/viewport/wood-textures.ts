import * as THREE from 'three';

/** Photographed oak (Poly Haven, CC0; see public/textures/MANIFEST.md), graded once on a canvas the way the
 * Cycles benchmark grades it (scripts/realism/benchmark_scene.py), and shared by every editor on the page.
 *
 * - Veneer: the cabinet's boards. Its colour map becomes a neutral grain image near white, so each finish
 *   colour (oak, walnut, white...) tints it, with the grain's contrast raised to read at phone size.
 *   1 m square, grain along the image width.
 * - Planks: the floor. Lightened and desaturated towards the light oak of the reference. 1.2 m square, boards
 *   along the image width.
 *
 * Textures are returned at once and filled in when their image arrives, so building a scene never waits;
 * where images cannot load (tests, a missing file) they stay blank and the material shows its plain colour. */
/** The cabinet's oak photograph (public/textures/oak_photo) covers 110 cm along the grain by 60 cm across it. */
export const VENEER_TILE = { along: 110, across: 60 } as const, PLANK_TILE_CM = 120;

type Kind = 'veneer' | 'planks';
type MapName = 'diff' | 'rough' | 'nor_gl';
const ASSET: Record<Kind, string> = { veneer: 'oak_veneer_02', planks: 'oak_wood_planks' };
const images = new Map<string, Promise<CanvasImageSource | null>>();

function textureUrl(kind: Kind, map: MapName) {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  // The cabinet's colour is a photographed oak panel (supplied by the project owner); its pores and sheen are Oak Veneer 02's.
  if (kind === 'veneer' && map === 'diff') return `${base}textures/oak_photo/oak_photo_diff.jpg`;
  return `${base}textures/${ASSET[kind]}/${ASSET[kind]}_${map}_2k.jpg`;
}

/** The image for one map, loaded and (for colour) graded once per page. */
function image(document: Document, kind: Kind, map: MapName): Promise<CanvasImageSource | null> {
  const key = kind + ':' + map;
  let pending = images.get(key);
  if (!pending) {
    pending = new Promise<CanvasImageSource | null>(resolve => {
      const view = document.defaultView;
      if (!view || typeof view.Image !== 'function') { resolve(null); return; }
      const img = new view.Image();
      img.decoding = 'async';
      img.onload = () => resolve(map === 'diff' && kind !== 'veneer' ? grade(document, img, kind) : img);
      img.onerror = () => resolve(null);
      img.src = textureUrl(kind, map);
    });
    images.set(key, pending);
  }
  return pending;
}

/** Colour grading, in sRGB on a canvas. */
function grade(document: Document, img: HTMLImageElement, kind: Kind): CanvasImageSource {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return img;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, canvas.width, canvas.height), px = data.data;
  let mean = 0;
  for (let i = 0; i < px.length; i += 4) mean += .2126 * px[i]! + .7152 * px[i + 1]! + .0722 * px[i + 2]!;
  mean /= px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]!, gr = px[i + 1]!, b = px[i + 2]!, l = .2126 * r + .7152 * gr + .0722 * b;
    if (kind === 'veneer') {
      // Grain around 92 % white with the veneer's own warmth, its contrast raised about 2.2 times.
      const v = Math.max(0, Math.min(255, 235 + (l - mean) * 2.2));
      px[i] = Math.min(255, v * 1.06); px[i + 1] = v * .96; px[i + 2] = v * .9;
    } else {
      // 72 % of the original colour, lightened so the mean sits near the reference floor.
      const lift = 150 / mean;
      px[i] = Math.min(255, (l + (r - l) * .72) * lift);
      px[i + 1] = Math.min(255, (l + (gr - l) * .72) * lift);
      px[i + 2] = Math.min(255, (l + (b - l) * .72) * lift);
    }
  }
  g.putImageData(data, 0, 0);
  return canvas;
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
    const texture = new THREE.Texture(placeholder(document, map === 'nor_gl' ? '#8080ff' : '#ffffff'));
    texture.needsUpdate = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    if (map === 'diff') texture.encoding = THREE.sRGBEncoding;
    void image(document, kind, map).then(source => {
      if (!source) return;
      texture.image = source;
      texture.needsUpdate = true;
    });
    return texture;
  };
  return { map: make('diff'), roughnessMap: make('rough'), normalMap: make('nor_gl') };
}
