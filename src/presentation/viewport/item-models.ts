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
export const SHORT_GARMENTS = ['tshirt', 'sweater', 'checkshirt'] as const;
export const LONG_GARMENTS = ['trench'] as const;
/** Shoes for the shoe shelves: men's and women's, one shoe mirrored into a pair or a pair as modelled. Leathers
 * multiply a photographed material; colours replace a plain one. */
export const SHOE_MODELS = [
  { name: 'oxford', pair: false, shades: ['#ffffff', '#3d3a37', '#ffe0bf'] },
  { name: 'pumps', pair: true, shades: ['#1f1d1c', '#c8a387', '#7d1f26', '#ece6dc'] },
  { name: 'ankleboot', pair: false, shades: ['#ffffff', '#4a443f', '#d9b48f'] },
] as const;
export const ITEM_MODELS = [...SHORT_GARMENTS, ...LONG_GARMENTS, ...SHOE_MODELS.map(s => s.name)];

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

/** The item if it has arrived, else null. */
export const itemModel = (name: string) => models.get(name) ?? null;
