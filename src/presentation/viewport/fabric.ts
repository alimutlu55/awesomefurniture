import * as THREE from 'three';

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
    band.addColorStop(.5, `rgba(60,50,40,${.07 + random() * .08})`);
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

/** Colours of the clothes on the rails: the calm neutrals of a styled wardrobe. */
export const GARMENT_COLOURS = ['#ecebe6', '#d8cfbe', '#9a9488', '#5f6650', '#3b3c3a', '#c4b59c', '#46505f', '#b9b4aa'] as const;
