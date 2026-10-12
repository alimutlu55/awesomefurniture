import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Real items for the wardrobe's contents: downloaded 3D models of real garments and shoes (sources and licences:
 * public/models/MANIFEST.md), prepared by scripts/realism/prepare_models.py.
 *
 * Each loads once per page. Until it arrives (or where it cannot load, as in tests) `itemModel` returns null and
 * the renderer draws its simple stand-in. Geometry is shared by every copy. Centimetres.
 * - Garments: parts 'garment' and 'hanger'; the hook's top at the origin, the shoulders along x, hanging down -y,
 *   the folds' ambient occlusion in the garment's vertex colours.
 * - Shoes: part 'shoe' (one shoe, or a pair) with its own material; the soles' centre at the origin, toes to +z. */
export interface ItemPart { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material }
export interface ItemModel {
  readonly parts: ReadonlyMap<string, ItemPart>;
  /** The whole item's bounds. */
  readonly size: THREE.Vector3;
  readonly min: THREE.Vector3;
}

/** Garments for ordinary rails, and for long ones (a long rail holds dresses and coats). */
export const SHORT_GARMENTS = ['dressshirt', 'dressshirt', 'sweater'] as const;
export const LONG_GARMENTS = ['tancoat'] as const;
/** Shoes for the shoe shelves: men's and women's, one shoe mirrored into a pair or a pair as modelled. Leathers
 * multiply a photographed material; colours replace a plain one. */
export const SHOE_MODELS = [
  { name: 'oxford', pair: false, shades: ['#ffffff', '#3d3a37', '#ffe0bf'] },
  { name: 'pumps', pair: true, shades: ['#1f1d1c', '#c8a387', '#7d1f26', '#ece6dc'] },
  { name: 'ankleboot', pair: false, shades: ['#ffffff', '#4a443f', '#d9b48f'] },
] as const;
export const ITEM_MODELS = [...new Set([...SHORT_GARMENTS, ...LONG_GARMENTS, ...SHOE_MODELS.map(s => s.name)])];

const models = new Map<string, ItemModel | null>();
const loading = new Map<string, Promise<ItemModel | null>>();

function modelUrl(name: string) {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base}models/${name}.glb`;
}

/** Starts loading an item once per page; resolves with it, or null if it cannot load. */
export function loadItem(name: string): Promise<ItemModel | null> {
  let pending = loading.get(name);
  if (!pending) {
    pending = new Promise<ItemModel | null>(resolve => {
      if (typeof window === 'undefined' || typeof window.document === 'undefined') { resolve(null); return; }
      new GLTFLoader().load(modelUrl(name), gltf => {
        const parts = new Map<string, ItemPart>(), box = new THREE.Box3();
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse(o => {
          if (!(o instanceof THREE.Mesh)) return;
          const key = o.name.replace(/[._]\d+$/, '');
          if (parts.has(key)) return;
          // Metres to centimetres, once, with the node's own placement.
          const geometry = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld).scale(100, 100, 100);
          geometry.computeBoundingBox();
          box.union(geometry.boundingBox!);
          parts.set(key, { geometry, material: o.material as THREE.Material });
        });
        const model = parts.size ? { parts, size: box.getSize(new THREE.Vector3()), min: box.min.clone() } : null;
        models.set(name, model);
        resolve(model);
      }, undefined, () => { models.set(name, null); resolve(null); });
    });
    loading.set(name, pending);
  }
  return pending;
}

/** Photographs of single garments hanging in profile on wooden hangers, cut out (public/textures/garments): each
 * one's length from the hook's top to the hem in centimetres, its width over height, and where its hook is across it. */
export const GARMENT_PHOTOS = [
  { name: 'shirt', length: 88, aspect: .2826, hook: .476 },
  { name: 'tshirt', length: 78, aspect: .237, hook: .422 },
  { name: 'overshirt', length: 88, aspect: .2539, hook: .504 },
  { name: 'hoodie', length: 80, aspect: .2669, hook: .493 },
  { name: 'skirt', length: 90, aspect: .2917, hook: .457 },
  { name: 'cardigan', length: 105, aspect: .2669, hook: .442 },
  { name: 'chinos', length: 112, aspect: .1693, hook: .481 },
  { name: 'shirtdress', length: 125, aspect: .2344, hook: .45 },
] as const;
export type GarmentPhoto = typeof GARMENT_PHOTOS[number] & { readonly texture: THREE.Texture };
let photos: GarmentPhoto[] | null = null, photosLoading = false;
const photoListeners = new Set<() => void>();
/** The garment photographs once all have loaded (one texture each for the page), else null; starts loading on first call. */
export function garmentPhotos(): readonly GarmentPhoto[] | null {
  if (!photosLoading && typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    photosLoading = true;
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/', loader = new THREE.TextureLoader();
    void Promise.all(GARMENT_PHOTOS.map(g => new Promise<GarmentPhoto | null>(resolve => loader.load(`${base}textures/garments/${g.name}.webp`, texture => {
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = 4;
      resolve({ ...g, texture });
    }, undefined, () => resolve(null))))).then(all => {
      const loaded = all.filter((g): g is GarmentPhoto => !!g);
      if (!loaded.length) return;
      photos = loaded;
      photoListeners.forEach(f => f());
    });
  }
  return photos;
}
/** Calls `f` when the garment photographs have loaded; returns a function that stops listening. */
export function onGarmentPhotos(f: () => void) { photoListeners.add(f); return () => photoListeners.delete(f); }

/** The item if it has arrived, else null. */
export const itemModel = (name: string) => models.get(name) ?? null;
