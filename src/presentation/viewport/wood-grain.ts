import * as THREE from 'three';

/** Oak grain for the wardrobe's panels, drawn once on a canvas: long fibres with a slow wave, a few
 * growth-ring arches (the "cathedral" figure of crown-cut oak), pores, and gentle colour drift along the
 * board. Near-white so the finish colour multiplies through it; contrast is kept low, as on a real
 * lacquered board seen from a metre or two. Grain runs along the texture's height. */
export function oakGrain(document: Document, anisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  let seed = 41;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  g.fillStyle = '#ece6dc';
  g.fillRect(0, 0, 512, 1024);
  // Broad colour drift across the board.
  for (let i = 0; i < 9; i++) {
    const x = random() * 512, w = 30 + random() * 90;
    g.fillStyle = `rgba(${random() > .5 ? '120,88,52' : '255,248,236'},${.03 + random() * .05})`;
    g.fillRect(x, 0, w, 1024);
  }
  // Growth-ring arches: nested curves peaking somewhere along the board.
  for (let a = 0; a < 3; a++) {
    const cx = 60 + random() * 392, peak = 120 + random() * 780, rings = 6 + Math.floor(random() * 6);
    for (let r = 0; r < rings; r++) {
      const spread = 10 + r * (7 + random() * 4), rise = 160 + r * 40;
      g.strokeStyle = `rgba(110,78,44,${.025 + random() * .03})`;
      g.lineWidth = .8 + random() * 1.4;
      g.beginPath();
      g.moveTo(cx - spread, 1024);
      g.bezierCurveTo(cx - spread, peak + rise * .4, cx - spread * .25, peak, cx, peak - 4);
      g.bezierCurveTo(cx + spread * .25, peak, cx + spread, peak + rise * .4, cx + spread, 1024);
      g.stroke();
    }
  }
  // Straight fibres with a slow wave.
  for (let i = 0; i < 900; i++) {
    const x = random() * 512, wave = 2 + random() * 5, phase = random() * 6.28;
    g.strokeStyle = `rgba(${random() > .35 ? '104,74,42' : '255,250,240'},${.025 + random() * .06})`;
    g.lineWidth = .4 + random() * 1.1;
    g.beginPath();
    for (let y = 0; y <= 1024; y += 64) {
      const px = x + Math.sin(y / 180 + phase) * wave;
      if (y) g.lineTo(px, y); else g.moveTo(px, y);
    }
    g.stroke();
  }
  // Pores: short dark dashes along the fibres.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(90,62,34,${.05 + random() * .1})`;
    g.fillRect(random() * 512, random() * 1024, .9, 2 + random() * 5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}
