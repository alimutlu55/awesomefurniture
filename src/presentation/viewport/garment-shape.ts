import * as THREE from 'three';
import {
  DRAPE,
  TAU,
  clamp,
  smooth,
  mulberry32,
  FABRICS,
  GARMENT_TYPES,
  HOOK_CM,
  type FabricKey,
  type GarmentKey,
  type GarmentSpec,
  type GarmentType,
} from './garment-types';

export {
  DRAPE,
  TAU,
  clamp,
  smooth,
  mulberry32,
  FABRICS,
  GARMENT_TYPES,
  HOOK_CM,
  type FabricKey,
  type GarmentKey,
  type GarmentSpec,
  type GarmentType,
};

const pickType = (r: number): GarmentKey => {
  const q = r * 12;
  return q < 3 ? 'tee' : q < 6 ? 'shirt' : q < 9 ? 'jacket' : q < 11 ? 'sweater' : 'coat';
};

const PH0 = [0.6, 1.9, 3.1, 0.5, 2.2] as const;

/** Prepares a garment's specific measurements for the given available height and depth in cm. */
export function makeGarmentSpec(
  seed: number,
  targetHeight: number,
  maxDepth: number,
  baseColorHex?: string,
  front = false,
): GarmentSpec {
  const rnd = mulberry32(seed), r: number[] = [];
  for (let k = 0; k < 32; k++) r.push(rnd());
  const roll = (k: number) => r[k] ?? 0.5;
  const v = DRAPE.variation, vp = Math.min(1, v);
  const key = DRAPE.mix === 'mixed' ? pickType(roll(0)) : DRAPE.mix;
  const ty: GarmentType = GARMENT_TYPES[key];

  const fit = clamp(maxDepth / (2 * ty.sh), 0.7, 1.05);
  const sW = fit * (1 + (roll(1) - 0.5) * 0.2 * v);
  const sL = 1 - roll(2) * 0.08 * v;
  const sS = 1 + (roll(3) - 0.5) * 0.2 * v;

  const hex = baseColorHex ?? ty.palette[Math.floor(roll(4) * ty.palette.length) % ty.palette.length]!;
  const color = new THREE.Color(hex);
  if (v > 0) {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    color.setHSL(hsl.h + (roll(5) - 0.5) * 0.03 * v, clamp(hsl.s + (roll(6) - 0.5) * 0.12 * v, 0, 1), clamp(hsl.l + (roll(7) - 0.5) * 0.09 * v, 0, 1));
  }

  const len = Math.max(25, (targetHeight - HOOK_CM - ty.hemDrop) * sL);
  const sr0 = ty.sr0 * sW;
  const sleeve = Math.min(ty.sleeve * fit * sS, len - ty.drop - sr0 * 0.6 - 3.0);
  const baseRot = front ? 0 : (DRAPE.turn * Math.PI) / 180;

  return {
    key, ty,
    sh: ty.sh * sW, chest: ty.chest * sW, neck: ty.neck * sW, neckF: ty.neckF, neckB: ty.neckB, drop: ty.drop,
    len, sleeve: Math.max(8, sleeve), sr0, sr1: ty.sr1 * sW,
    rotY: baseRot + (roll(11) - 0.5) * 0.55 * v,
    tiltZ: (roll(12) - 0.5) * 0.04 * v,
    color,
    ph: PH0.map((p, i) => p + roll(13 + i) * TAU * vp),
    foldAmt: 1 + (roll(18) - 0.5) * 0.7 * v,
    hemAmp: 1.8 * (1 + (roll(19) - 0.5) * 0.8 * v),
    hp: 0.7 + roll(20) * TAU * vp,
    omega: 3.8 * (0.85 + 0.3 * roll(22)) / Math.sqrt(len / 70),
    ph1: roll(23) * TAU,
    ph2: roll(24) * TAU,
  };
}

interface Pt { x: number; y: number; z: number; a: number; u: number; v: number }
type Surface = (s: number, t: number, off: number) => Pt;

function aoBase(y: number) {
  if (!DRAPE.shadows) return 1;
  const dd = -y + HOOK_CM; // distance below rail in cm
  return (1 - 0.38 * (1 - smooth(0, 20, dd))) * (1 - 0.22 * clamp(dd / 120, 0, 1));
}

function foldNoise(sp: GarmentSpec, xn: number, t: number, side: number) {
  const o = side < 0 ? 1.3 : 0, ph = (i: number) => sp.ph[i] ?? 0;
  return (0.6 * Math.sin(TAU * 1.7 * xn + ph(0) + o + 0.8 * Math.sin(2.1 * t + ph(3))) +
    0.3 * Math.sin(TAU * 3.3 * xn + ph(1) + o + 0.9 * Math.sin(3.3 * t + ph(4))) +
    0.14 * Math.sin(TAU * 6.1 * xn + ph(2))) / 1.04;
}

function foldK(sp: GarmentSpec) {
  return DRAPE.folds ? DRAPE.foldDepth * sp.foldAmt : 0;
}

function profS(s: number) {
  const a = Math.abs(s);
  return Math.sqrt(Math.max(0, 1 - a * a * a * a));
}

const hemWave = (sp: GarmentSpec, xn: number) =>
  sp.hemAmp * (0.65 * Math.sin(TAU * 2.2 * xn + sp.hp) + 0.35 * Math.sin(TAU * 5.3 * xn + sp.hp * 2.3));

export function yTop(sp: GarmentSpec, x: number, side: number) {
  const ax = Math.abs(x);
  if (ax < sp.neck) {
    const q = 1 - (x / sp.neck) * (x / sp.neck);
    return -(side > 0 ? sp.neckF : sp.neckB) * q;
  }
  const u = clamp((ax - sp.neck) / (sp.sh - sp.neck), 0, 1);
  return -sp.drop * Math.pow(u, 1.25);
}

function panel(sp: GarmentSpec, side: number, s: number, t: number, off: number): Pt {
  const ty = sp.ty, sh = sp.sh, x0 = s * sh, xn = x0 / (2 * sh), k = foldK(sp);
  const yt = yTop(sp, x0, side), yb = -sp.len - ty.hemDrop * s * s, wave = k > 0 ? -sp.len * k * hemWave(sp, xn) : 0;
  const y = yt + (yb - yt) * t + wave * t * t * t;
  const d = -y, ap = sp.drop + ty.armH;
  let hw = sp.chest + (sh - sp.chest) * (1 - smooth(sp.drop, ap, d));
  hw *= 1 - ty.waist * smooth(ap, ap + 10, d) * (1 - smooth(ap + 10, sp.len * 0.95, d));
  hw *= 1 + ty.flare * smooth(sp.len * 0.5, sp.len, d);
  const x = s * hw;
  const dhc = 0.8 + (ty.dChest / 2 - 0.8) * smooth(0, ap, d);
  const dh = dhc + (ty.dHem / 2 - dhc) * smooth(ap, sp.len, d);
  let z = side * (dh * profS(s) + off), f = 0;
  if (k > 0) {
    f = foldNoise(sp, xn, t, side);
    z += side * 1.0 * ty.stiff * k * (0.15 + 0.85 * smooth(4, 50, d)) * f;
  }
  const a = aoBase(y) * (k > 0 ? 0.84 + 0.16 * (0.5 + 0.5 * f) : 1) * (DRAPE.shadows ? 1 - 0.25 * smooth(0.75, 1, Math.abs(s)) : 1);
  return { x, y, z, a, u: x, v: y };
}

function cap(sp: GarmentSpec, side: number, s: number, ang: number, off: number): Pt {
  const x = side * (sp.neck + (sp.sh - sp.neck) * s);
  const rad = 0.8 * profS(x / sp.sh) + off;
  const y = yTop(sp, x, 1) + rad * 0.6 * Math.sin(ang);
  return { x, y, z: rad * Math.cos(ang), a: aoBase(y), u: x, v: y };
}

function sleeve(sp: GarmentSpec, side: number, th: number, v: number, off: number): Pt {
  const r = sp.sr0 + (sp.sr1 - sp.sr0) * Math.pow(v, 0.8);
  const capK = 0.5 + 0.5 * smooth(0, 0.1, v), k = foldK(sp);
  const cx0 = side * (sp.sh - sp.sr0 * 0.45), cxEnd = side * (sp.chest + r * 0.6 + 0.4);
  const cx = cx0 + (cxEnd - cx0) * smooth(0, 0.4, v) + side * 1.0 * v * v;
  const cy = -sp.drop - sp.sr0 * 0.6 - v * sp.sleeve, cz = 0.4 * Math.sin(Math.PI * v);
  const rx = r * capK, rz = r * (0.28 + 0.3 * (1 - sp.ty.stiff)) * capK * (1 - 0.5 * smooth(0.9, 1, v));
  const ph = (i: number) => sp.ph[i] ?? 0;
  const fr = k > 0 ? k * sp.ty.stiff * ((0.09 * Math.sin(3 * th + ph(0) + 3.1 * v) + 0.05 * Math.sin(5 * th + ph(1) - 4 * v)) *
    (0.4 + 0.6 * smooth(0, 0.3, v)) + 0.025 * Math.sin(14 * v + ph(2))) : 0;
  const cs = Math.cos(th), sn = Math.sin(th);
  const x = cx + (rx * (1 + fr) + off) * cs, z = cz + (rz * (1 + fr) + off) * sn;
  const inward = Math.max(0, -side * cs);
  const a = aoBase(cy) * (DRAPE.shadows ? 1 - 0.32 * inward * smooth(5, 30, v * sp.sleeve) : 1) * (k > 0 ? 0.9 + 0.1 * clamp(0.5 + 4 * fr, 0, 1) : 1);
  return { x, y: cy, z, a, u: th * (rx + rz) * 0.5, v: cy };
}

function collarRing(sp: GarmentSpec, phi: number, w: number, off: number, up: boolean, h: number): Pt {
  const cs = Math.cos(phi), sn = Math.sin(phi), front = sn > 0;
  const yn = -(front ? sp.neckF : sp.neckB) * sn * sn;
  let x = sp.neck * cs, y: number, z: number;
  if (up) {
    y = yn + w * h;
    z = (0.85 + off + 0.6 * w) * sn;
    x *= 1 + 0.04 * w;
  } else {
    y = yn - w * h * (front ? 1 : 0.6);
    z = (0.85 + off) * sn;
  }
  return { x, y, z, a: aoBase(y), u: phi * sp.neck, v: y };
}

/** Builds the full 3D BufferGeometry for a garment in centimetres. */
export function buildGarmentGeometry(sp: GarmentSpec): THREE.BufferGeometry {
  const ty = sp.ty, us = FABRICS[ty.fab].us;
  const pos: number[] = [], uv: number[] = [], col: number[] = [];
  const idx: [number[], number[], number[]] = [[], [], []];
  let count = 0;

  const addV = (p: Pt) => {
    pos.push(p.x, p.y, p.z);
    // UV coordinates in metres scaled by fabric frequency
    uv.push((p.u / 100) * us, (p.v / 100) * us);
    col.push(p.a, p.a, p.a);
    return count++;
  };

  function patch(fn: Surface, s0: number, s1: number, t0: number, t1: number, nu: number, nv: number, off: number, grp: 0 | 1 | 2) {
    const base = count, list = idx[grp];
    for (let j = 0; j <= nv; j++) {
      const t = t0 + (t1 - t0) * (j / nv);
      for (let i = 0; i <= nu; i++) addV(fn(s0 + (s1 - s0) * (i / nu), t, off));
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const A = base + j * (nu + 1) + i, B = A + 1, C = A + nu + 1, E = C + 1;
        list.push(A, C, B, B, C, E);
      }
    }
  }

  function disc(fn: Surface, s0: number, t0: number, rs: number, rt: number, off: number, grp: 0 | 1 | 2) {
    const N = 10, base = count;
    addV(fn(s0, t0, off));
    for (let k = 0; k < N; k++) {
      const an = (k / N) * TAU;
      addV(fn(s0 + rs * Math.cos(an), t0 + rt * Math.sin(an), off));
    }
    for (let k = 0; k < N; k++) idx[grp].push(base, base + 1 + k, base + 1 + ((k + 1) % N));
  }

  const F: Surface = (s, t, o) => panel(sp, 1, s, t, o), B: Surface = (s, t, o) => panel(sp, -1, s, t, o);
  const sleeveFn = (side: number): Surface => (th, v, o) => sleeve(sp, side, th, v, o);
  const [pu, pv, su, sv] = [16, 24, 14, 18];

  patch(F, -1, 1, 0, 1, pu, pv, 0, 0);
  patch(B, -1, 1, 0, 1, pu, pv, 0, 0);
  for (const side of [-1, 1]) {
    patch((s, a, o) => cap(sp, side, s, a, o), 0, 1, 0, Math.PI, 6, 6, 0, 0);
    const thIn = side > 0 ? Math.PI : 0;
    patch(sleeveFn(side), thIn, thIn + TAU, 0, 1, su, sv, 0, 0);
  }

  if (DRAPE.hardware) {
    const rS = (r: number) => r / (sp.sh * 0.9);
    if (ty.hemBand) {
      patch(F, -1, 1, 0.92, 1, pu, 2, 0.2, 1);
      patch(B, -1, 1, 0.92, 1, pu, 2, 0.2, 1);
    } else {
      patch(F, -1, 1, 0.952, 0.96, pu, 1, 0.1, 1);
      patch(B, -1, 1, 0.952, 0.96, pu, 1, 0.1, 1);
    }

    if (ty.collar === 'rib') {
      patch((phi, w, o) => collarRing(sp, phi, w, o, false, 2.2), 0, TAU, 0, 1, 18, 2, 0.25, 1);
    } else if (ty.collar === 'shirt') {
      patch((phi, w, o) => collarRing(sp, phi, w, o, true, 2.8), 0, TAU, 0, 1, 18, 2, 0.1, 0);
      for (const sg of [-1, 1]) {
        patch((u, w, o) => panel(sp, 1, sg * (0.03 + (sp.neck / sp.sh * 1.08 - 0.03) * u), w * 0.075 * (1 - u), o), 0, 1, 0, 1, 5, 5, 0.3, 0);
      }
    } else {
      patch((phi, w, o) => collarRing(sp, phi, w, o, true, 3.2), 0, TAU, 0, 1, 18, 2, 0.1, 1);
      for (const sg of [-1, 1]) {
        patch((u, w, o) => {
          const sIn = sg * 0.035, sOut = sg * (0.38 * (1 - w) + 0.035 * w);
          return panel(sp, 1, sIn + (sOut - sIn) * u, w * 0.34, o);
        }, 0, 1, 0, 1, 5, 8, 0.35, 1);
      }
    }

    if (ty.placket) {
      patch(F, -0.04, 0.04, 0.02, 1, 2, 16, 0.15, 0);
      patch(F, -0.044, -0.037, 0.02, 1, 1, 16, 0.2, 1);
      patch(F, 0.037, 0.044, 0.02, 1, 1, 16, 0.2, 1);
    } else if (ty.buttons) {
      patch(F, -0.006, 0.006, ty.buttons.t0 - 0.05, 1, 1, 16, 0.2, 1);
    }

    const bt = ty.buttons, scale = ty.len / sp.len;
    if (bt) {
      for (let b = 0; b < bt.n; b++) {
        const t = (bt.t0 + b * bt.dt) * (ty.placket ? 1 : scale);
        if (t < 0.97) disc(F, 0, t, rS(bt.r), bt.r / sp.len, 0.45, 2);
      }
    }

    if (ty.pocket === 'chest') {
      patch(F, 0.34, 0.66, 0.2 * scale, 0.31 * scale, 6, 6, 0.22, 0);
      patch(F, 0.34, 0.66, 0.2 * scale, 0.208 * scale, 6, 1, 0.28, 1);
    } else if (ty.pocket === 'flap' && ty.pocketT) {
      const [p0, p1] = ty.pocketT;
      for (const c of [-0.5, 0.5]) patch(F, c - 0.22, c + 0.22, p0 * scale, p1 * scale, 8, 3, 0.4, 1);
    }

    for (const side of [-1, 1]) {
      const fn = sleeveFn(side), thIn = side > 0 ? Math.PI : 0, thOut = thIn + Math.PI, rm = (sp.sr1 + sp.sr1 * 0.66) * 0.5;
      patch(fn, thIn, thIn + TAU, 0, 0.012, su, 1, 0.12, 1);
      patch(fn, thOut - 0.05, thOut + 0.05, 0.02, 1, 1, 24, 0.12, 1);
      if (ty.cuff === 'band') {
        patch(fn, thIn, thIn + TAU, 0.86, 1, su, 2, 0.18, 0);
        patch(fn, thIn, thIn + TAU, 0.86, 0.866, su, 1, 0.22, 1);
      } else if (ty.cuff === 'rib') {
        patch(fn, thIn, thIn + TAU, 0.9, 1, su, 3, 0.2, 1);
      } else {
        patch(fn, thIn, thIn + TAU, 0.955, 0.963, su, 1, 0.1, 1);
      }
      const n = ty.cuffButtons ?? 0;
      for (let cb = 0; cb < n; cb++) {
        const vb = n > 1 ? 0.9 + cb * 0.045 : 0.93;
        disc(fn, Math.PI / 2, vb, 0.55 / rm, 0.55 / sp.sleeve, 0.3, 2);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx[0].concat(idx[1], idx[2]));
  let start = 0;
  idx.forEach((list, m) => {
    if (list.length) g.addGroup(start, list.length, m);
    start += list.length;
  });
  g.computeVertexNormals();
  return g;
}
