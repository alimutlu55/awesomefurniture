export type StudyShape = 'regular' | 'alcove' | 'under-stairs';
export type StudyFinish = 'oak' | 'smoked' | 'chalk';
export interface StudyState { width: number; shape: StudyShape; finish: StudyFinish; inches: boolean }

const palettes = {
  oak: { face: '#c8a678', side: '#a17c51', top: '#dfc69f', back: '#b59670' },
  smoked: { face: '#77604d', side: '#4c3c30', top: '#a38b71', back: '#6d5744' },
  chalk: { face: '#e5e2d8', side: '#c0bcb0', top: '#faf8f1', back: '#d2cec2' },
};
export const studyMeasure = (cm: number, inches: boolean, lang = 'en') =>
  `${new Intl.NumberFormat(lang, { maximumFractionDigits: inches ? 1 : 0 }).format(inches ? cm / 2.54 : cm)} ${inches ? 'in' : 'cm'}`;

/** A small, illustrative material study. The actual editor remains the source of manufacturing geometry. */
export function studySvg(state: StudyState, lang = 'en'): string {
  const { width: w, shape, finish, inches } = state, p = palettes[finish];
  const origin = (800 - w * 1.5 - 39) / 2;
  const point = (x: number, y: number, z = 0) => [origin + x * 1.5 + z * .65, 510 - y * 1.5 - x * .16 - z * .45];
  const pts = (points: number[][]) => points.map(q => `${q[0]!.toFixed(1)},${q[1]!.toFixed(1)}`).join(' ');
  const poly = (points: number[][], color: string, cls = 'study-board') =>
    `<polygon class="${cls}" points="${pts(points)}" fill="${color}" stroke="#493c2d" stroke-opacity=".14" stroke-width=".65"/>`;
  const topAt = (x: number) => shape === 'under-stairs' ? Math.min(240, 82 + x / (w * .72) * 158)
    : shape === 'alcove' && x > w * .72 ? 205 : 240;
  const slab = (x: number, y: number, width: number, depth = 58) => {
    const a = point(x, y), b = point(x + width, y), c = point(x + width, y, depth), d = point(x, y, depth);
    return poly([a, b, c, d], p.top) + poly([a, b, point(x + width, y - 1.8), point(x, y - 1.8)], p.face);
  };
  const upright = (x: number, h: number, thickness = 1.8) =>
    poly([point(x, 8), point(x, h), point(x, h, 58), point(x, 8, 58)], p.side)
    + poly([point(x, 8), point(x, h), point(x + thickness, h), point(x + thickness, 8)], p.face)
    + poly([point(x, h), point(x + thickness, h), point(x + thickness, h, 58), point(x, h, 58)], p.top);
  const n = w >= 260 ? 4 : 3, bay = (w - 1.8) / n;
  const backTop = shape === 'under-stairs' ? [point(0, 82, 58), point(w * .72, 240, 58), point(w, 240, 58)]
    : shape === 'alcove' ? [point(0, 240, 58), point(w * .72, 240, 58), point(w * .72, 205, 58), point(w, 205, 58)]
    : [point(0, 240, 58), point(w, 240, 58)];
  let boards = poly([point(0, 8, 58), ...backTop, point(w, 8, 58)], p.back, 'study-back');
  boards += `<g class="study-grain" opacity=".1" stroke="#4d3821" stroke-width=".6">`;
  for (let x = 5; x < w; x += 5.5) {
    const a = point(x, 9, 57), b = point(x, topAt(x) - 1, 57);
    boards += `<path d="M${a} Q${a[0]! + 3},${(a[1]! + b[1]!) / 2} ${b}" fill="none"/>`;
  }
  boards += '</g>' + upright(0, topAt(0)) + slab(0, 9, w);
  for (let k = 0; k < n; k++) {
    const x = k * bay + 2, bw = bay - 2, h = Math.min(topAt(x), topAt(x + bw)) - 2;
    if (k === 1 && h > 160) {
      boards += slab(x, h - 36, bw);
      const a = point(x + 2, h - 45, 27), b = point(x + bw - 2, h - 45, 27);
      boards += `<path class="study-rail" d="M${a} L${b}" stroke="#9b958a" stroke-width="3"/>`;
      for (let j = 0; j < 5; j++) {
        const q = point(x + 8 + j * Math.max(3, (bw - 16) / 5), h - 50, 24), c = ['#e6e2d5', '#abb6b0', '#f4efe0', '#b8a18c', '#d3d7cc'][j];
        boards += `<path class="study-clothes" d="M${q[0]},${q[1]} l-12,8 -5,24 9,3 2,-10 0,64 23,0 -1,-64 4,12 8,-5 -8,-24 -12,-8 z" fill="${c}" stroke="#615649" stroke-opacity=".17"/>`;
      }
      boards += slab(x, 54, bw);
    } else {
      const shelves = Math.max(2, Math.floor(h / 48));
      for (let j = 1; j < shelves; j++) {
        const sy = 9 + (h - 9) * j / shelves;
        boards += slab(x, sy, bw);
        if (j % 2 && h > 130) {
          const q = point(x + 8, sy + 1.8, 18), r = point(x + bw - 8, sy + 1.8, 18);
          boards += `<path class="study-clothes" d="M${q} L${r} l0,-12 -${Math.max(15, (bw - 16) * 1.5)},0 z" fill="#d9d4c9" stroke="#a29b8d" stroke-width=".8"/>`;
        }
      }
    }
    if (k > 0) boards += upright(k * bay, Math.min(topAt(k * bay - .1), topAt(k * bay + .1)));
  }
  boards += upright(w - 1.8, topAt(w));
  const roof = (x: number, end: number, h1: number, h2: number) =>
    poly([point(x, h1), point(end, h2), point(end, h2, 58), point(x, h1, 58)], p.top);
  boards += shape === 'under-stairs' ? roof(0, w * .72, 82, 240) + roof(w * .72, w, 240, 240)
    : shape === 'alcove' ? roof(0, w * .72, 240, 240) + roof(w * .72, w, 205, 205)
    : roof(0, w, 240, 240);
  const left = point(0, -16), right = point(w, -16), heightBase = point(w + 22, 8), heightTop = point(w + 22, topAt(w));
  return `<svg class="furniture-study" viewBox="0 0 800 620" role="img" aria-label="${studyMeasure(w, inches, lang)}">
    <defs>
      <radialGradient id="study-shadow"><stop stop-color="#51412c" stop-opacity=".2"/><stop offset="1" stop-color="#51412c" stop-opacity="0"/></radialGradient>
      <pattern id="study-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#b8b6ac" stroke-width=".5"/></pattern>
    </defs>
    <rect class="study-grid" width="800" height="620" fill="url(#study-grid)" opacity="0"/>
    <ellipse class="study-shadow" cx="415" cy="505" rx="290" ry="65" fill="url(#study-shadow)"/>
    <g class="study-object">${boards}</g>
    <g class="study-dimensions" fill="none" stroke="currentColor" stroke-width=".8">
      <path d="M${left} L${right} M${point(0, 2)} L${point(0, -24)} M${point(w, 2)} L${point(w, -24)}"/>
      <path d="M${heightBase} L${heightTop} M${point(w + 15, 8)} L${point(w + 29, 8)} M${point(w + 15, topAt(w))} L${point(w + 29, topAt(w))}"/>
      <text x="${(left[0]! + right[0]!) / 2}" y="${(left[1]! + right[1]!) / 2 + 24}" stroke="none" fill="currentColor" text-anchor="middle">${studyMeasure(w, inches, lang)}</text>
      <text x="${heightBase[0]! + 14}" y="${(heightBase[1]! + heightTop[1]!) / 2}" stroke="none" fill="currentColor">${studyMeasure(240, inches, lang)}</text>
    </g>
  </svg>`;
}
