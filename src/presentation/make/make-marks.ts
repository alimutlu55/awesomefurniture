import type { Board } from '../../domain/drawings/cabinet-boards';
import { type Measure, partMeasures, pieceMeasures, thinAxis, type Vec3 } from '../../domain/make/make-measures';
import type { MakePart, MakePiece } from '../../domain/make/make-parts';

/** A length (centimetres) as the person reads it, in their unit. */
export type LengthText = (cm: number) => string;
/** A point of the piece on the screen, in pixels; `false` when it is behind the camera. */
export type Projected = readonly [number, number] | false;
/** Where a point of the piece (centimetres from its left face, floor and back) is on the screen. `facing` says how
 * squarely a plane through a point faces the viewer (the cosine: 1 square on, 0 edge on, below 0 from behind). */
export type Projector = ((p: Vec3) => Projected) & { facing?: (at: Vec3, normal: Vec3) => number };
/** What the marks show: measurements or not, how far apart, which part, whether fronts are solid. */
export interface MarksState {
  readonly measures: boolean;
  readonly numbers: boolean;
  readonly apart: number;
  readonly solidFronts: boolean;
  readonly selected: number | null;
}

type Box = [number, number, number, number];
const isFront = (p: MakePart) => p.stock === 'door' || p.stock === 'front';
const n1 = (v: number) => v.toFixed(1);
const line = (a: readonly [number, number], b: readonly [number, number], cls: string) =>
  `<line class="${cls}" x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}"/>`;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const overlaps = (box: Box, placed: readonly Box[]) => placed.some(q => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]);

/**
 * Measurement lines and their labels, in screen pixels. Higher ranks are placed first; a label that would sit on one
 * already placed, or that is squeezed by the angle it is seen at, waits until the view turns and there is room.
 * `move` is where the measurement's board has gone when the piece is apart.
 */
export function measureMarks(pr: Projector, list: readonly Measure[], length: LengthText, fs: number, move: (m: Measure) => Vec3, placed: Box[] = []) {
  let out = '';
  for (const m of [...list].sort((a, b) => a.rank - b.rank)) {
    const shift = move(m), a0 = add(m.a, shift), b0 = add(m.b, shift);
    if (m.face && pr.facing && pr.facing([(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2, (a0[2] + b0[2]) / 2], m.face) < .35) continue;
    const pa = pr(a0), pb = pr(b0), PA = pr(add(a0, m.offset)), PB = pr(add(b0, m.offset));
    if (!pa || !pb || !PA || !PB) continue;
    const size = m.rank === 1 ? fs : fs * .92, label = length(m.length), d = [PB[0] - PA[0], PB[1] - PA[1]] as const, dl = Math.hypot(d[0], d[1]);
    const tw = label.length * size * .62 + size * .8, th = size * 1.45;
    if (dl < Math.min(tw, th * 2.2)) continue;
    let e = [PA[0] - pa[0], PA[1] - pa[1]], el = Math.hypot(e[0]!, e[1]!);
    if (el < 1e-6) { e = [-d[1] / dl, d[0] / dl]; if (e[1]! > 0) e = [-e[0]!, -e[1]!]; el = 0; } else e = [e[0]! / el, e[1]! / el];
    const cx = (PA[0] + PB[0]) / 2 + e[0]! * size * .85, cy = (PA[1] + PB[1]) / 2 + e[1]! * size * .85;
    const box: Box = [cx - tw / 2, cy - th / 2, cx + tw / 2, cy + th / 2];
    if (overlaps(box, placed)) continue;
    placed.push(box);
    const k = 4, u = [d[0] / dl, d[1] / dl] as const, tick = (p: readonly [number, number]) =>
      line([p[0] - (u[0] + e[0]!) * k * .7, p[1] - (u[1] + e[1]!) * k * .7], [p[0] + (u[0] + e[0]!) * k * .7, p[1] + (u[1] + e[1]!) * k * .7], 'make-dim');
    if (el) out += line(pa, [PA[0] + e[0]! * k, PA[1] + e[1]! * k], 'make-ext') + line(pb, [PB[0] + e[0]! * k, PB[1] + e[1]! * k], 'make-ext');
    out += `<g class="make-measure r${m.rank}">` + line(PA, PB, 'make-dim') + tick(PA) + tick(PB)
      + `<rect class="make-tag" x="${n1(box[0])}" y="${n1(box[1])}" width="${n1(tw)}" height="${n1(th)}" rx="${n1(th / 2)}"/>`
      + `<text class="make-tagt" font-size="${n1(size)}" x="${n1(cx)}" y="${n1(cy)}" text-anchor="middle" dominant-baseline="central">${label}</text></g>`;
  }
  return out;
}

/** Taken apart: each part's size on its first board, where it faces the viewer most. */
function sizeLabels(pr: Projector, piece: MakePiece, offsetOf: (b: Board) => Vec3, length: LengthText, fs: number, solidFronts: boolean, placed: Box[]) {
  let out = '';
  for (const part of piece.parts) {
    if (isFront(part) && !solidFronts) continue;
    const b = part.boards[0]!, thin = thinAxis(b);
    const c: Vec3 = thin === 'z' ? [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1] : thin === 'y' ? [(b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) / 2] : [b.x1, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
    const q = pr(add(c, offsetOf(b)));
    if (!q) continue;
    const label = `${length(part.cut.length)} × ${length(part.cut.width)}`, size = fs * .92, tw = label.length * size * .6 + size * .8, th = size * 1.45;
    const box: Box = [q[0] - tw / 2, q[1] - th / 2, q[0] + tw / 2, q[1] + th / 2];
    if (overlaps(box, placed)) continue;
    placed.push(box);
    out += `<g class="make-measure r2"><rect class="make-tag" x="${n1(box[0])}" y="${n1(box[1])}" width="${n1(tw)}" height="${n1(th)}" rx="${n1(th / 2)}"/>`
      + `<text class="make-tagt" font-size="${n1(size)}" x="${n1(q[0])}" y="${n1(q[1])}" text-anchor="middle" dominant-baseline="central">${label}</text></g>`;
  }
  return out;
}

/** Part numbers beside the piece, in two columns at the screen's sides, each with a leader to its part. */
function numberMarks(pr: Projector, piece: MakePiece, offsetOf: (b: Board) => Vec3, size: { w: number; h: number }, fs: number, selected: number | null) {
  const anchors: { n: number; x: number; y: number; ty: number }[] = [];
  for (const part of piece.parts) {
    const b = part.boards[0]!, thin = thinAxis(b), at: Vec3 = thin === 'y' ? [(b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) / 2] : [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1];
    const s = pr(add(at, offsetOf(b)));
    if (s) anchors.push({ n: part.n, x: s[0], y: s[1], ty: s[1] });
  }
  const mid = size.w / 2, r = fs * .95, gap = r * 2.4, margin = 24 + r;
  let out = '';
  for (const left of [true, false]) {
    const column = anchors.filter(a => (a.x < mid) === left).sort((a, b) => a.y - b.y);
    let y = 70;
    for (const a of column) { a.ty = Math.max(a.y, y); y = a.ty + gap; }
    let limit = size.h - 110;
    for (const a of [...column].reverse()) { a.ty = Math.min(a.ty, limit); limit = a.ty - gap; }
    for (const a of column) {
      const tx = left ? margin : size.w - margin, edge = left ? tx + r : tx - r;
      out += `<g class="make-num${selected === a.n ? ' sel' : ''}"><polyline class="make-lead" points="${n1(a.x)},${n1(a.y)} ${n1(edge)},${n1(a.ty)}"/>`
        + `<circle class="make-numc" cx="${n1(tx)}" cy="${n1(a.ty)}" r="${n1(r)}"/>`
        + `<text class="make-numt" font-size="${n1(fs * .85)}" x="${n1(tx)}" y="${n1(a.ty)}" text-anchor="middle" dominant-baseline="central">${a.n}</text></g>`;
    }
  }
  return out;
}

/** Everything Make writes over the model for its state, in screen pixels. */
export function marksSvg(piece: MakePiece, state: MarksState, pr: Projector, offsetOf: (b: Board) => Vec3, length: LengthText, size: { w: number; h: number }, fs = 13) {
  const placed: Box[] = [];
  let out = '';
  if (state.measures) {
    const part = state.selected === null ? null : piece.parts.find(p => p.n === state.selected) ?? null;
    if (part) out = measureMarks(pr, partMeasures(part, state.apart < .05), length, fs, () => offsetOf(part.boards[0]!), placed);
    else if (state.apart < .05) out = measureMarks(pr, pieceMeasures(piece), length, fs, () => [0, 0, 0], placed);
    else out = sizeLabels(pr, piece, offsetOf, length, fs, state.solidFronts, placed);
  }
  if (state.numbers) out += numberMarks(pr, piece, offsetOf, size, fs, state.selected);
  return out;
}
