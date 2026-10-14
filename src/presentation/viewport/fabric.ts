import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Woven cloth for garments, drawn once on a canvas: soft vertical folds (the light and shade of fabric
 * hanging from a hanger), a fine weave and a little slub. Near-white so each garment's colour multiplies
 * through it. Folds run along the texture's height. */
export function fabricTexture(document: Document) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d')!;
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#f2f0ec';
  g.fillRect(0, 0, 256, 256);
  // Folds: broad soft bands of shade, darker at the bottom where the cloth gathers.
  for (let i = 0; i < 7; i++) {
    const x = random() * 256, w = 14 + random() * 30, band = g.createLinearGradient(x - w, 0, x + w, 0);
    band.addColorStop(0, 'rgba(60,50,40,0)');
    band.addColorStop(.5, `rgba(60,50,40,${.04 + random() * .05})`);
    band.addColorStop(1, 'rgba(60,50,40,0)');
    g.fillStyle = band;
    g.fillRect(x - w, 0, w * 2, 256);
  }
  // Weave: fine crossing threads.
  for (let y = 0; y < 256; y += 2) {
    g.fillStyle = `rgba(80,70,60,${.02 + random() * .03})`;
    g.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 2) {
    g.fillStyle = `rgba(255,255,255,${.03 + random() * .03})`;
    g.fillRect(x, 0, 1, 256);
  }
  // Slub: short irregular threads.
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(90,80,70,${.04 + random() * .05})`;
    g.fillRect(random() * 256, random() * 256, 1, 3 + random() * 8);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

/** Colours of the clothes on the rails: warm and elegant pastel tones. */
export const GARMENT_COLOURS = ['#9bbfe0', '#a3c9a8', '#c4b5e6', '#f2b59d', '#ebb2c3', '#9cd9c8', '#f2dc99', '#acc0ea'] as const;

/** A box with softly rounded edges, for things made of cloth: a folded garment, a fabric storage box. */
export function softBox(w: number, h: number, d: number, material: THREE.Material, radius = 1.2) {
  const r = Math.max(.1, Math.min(radius, w / 2 - .01, h / 2 - .01, d / 2 - .01));
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** One shoe, toe towards +z: a sole, a low toe box and a higher heel counter, all softly rounded.
 * Centred on the origin with the sole on y = 0. */
export function shoe(width: number, height: number, length: number, material: THREE.Material, sole: THREE.Material) {
  const group = new THREE.Group(), base = softBox(width, 1.4, length, sole, .6), toe = softBox(width * .92, Math.max(2, height * .5), length * .55, material, 2);
  const heel = softBox(width * .9, Math.max(2, height - 1.4), length * .5, material, 1.8);
  base.position.y = .7;
  toe.position.set(0, 1.4 + toe.geometry.parameters.height / 2, length * .2);
  heel.position.set(0, 1.4 + heel.geometry.parameters.height / 2, -length * .24);
  group.add(base, toe, heel);
  return group;
}

/** Leathers and canvas for the shoes on a shoe shelf. */
export const SHOE_COLOURS = ['#3a2e26', '#e8e5de', '#7b5b41', '#22201e', '#a89c8b', '#5c4433'] as const;
