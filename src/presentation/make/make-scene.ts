import type { Board } from '../../domain/drawings/cabinet-boards';
import { apartOffset, type Measure, partMeasures, pieceMeasures, thinAxis, type Vec3 } from '../../domain/make/make-measures';
import type { MakePart, MakePiece } from '../../domain/make/make-parts';
import { boardFaces, boundsOf, type MakeView, paintOrder, projector, type Projected } from './make-projection';

/** What the model shows. `apart` runs from 0 (assembled) to 1 (taken apart). */
export interface ModelState {
  readonly view: MakeView;
  readonly apart: number;
  readonly solidFronts: boolean;
  readonly measures: boolean;
  readonly numbers: boolean;
  readonly selected: number | null;
}
/** A length (centimetres) as the person reads it, in their unit. */
export type LengthText = (cm: number) => string;
/** Shades of each part's decor for the Material look: top, front and side. */
export type PartShades = ReadonlyMap<number, { readonly ft: string; readonly ff: string; readonly fs: string }>;

const isFront = (p: MakePart) => p.stock === 'door' || p.stock === 'front';
const n2 = (v: number) => v.toFixed(2);
const P = (p: Projected) => n2(p[0]) + ',' + n2(p[1]);
const line = (a: Projected, b: Projected, cls: string) => `<line class="${cls}" x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}"/>`;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

interface Placed { part: MakePart; board: Board; offset: Vec3 }
/** Every board with where it is moved to, fronts included or not. */
function placedBoards(mp: MakePiece, apart: number): Placed[] {
  const all = mp.parts.flatMap(p => p.boards), top = Math.max(...all.map(b => b.y1));
  return mp.parts.flatMap(part => part.boards.map(board => ({ part, board, offset: scale(apartOffset(board, mp.size, top), apart) })));
}

/** The drawing's frame: everything assembled and at the current amount apart, with room for measurements and numbers. */
export function modelFrame(mp: MakePiece, state: Pick<ModelState, 'view' | 'apart' | 'numbers'>) {
  const pr = projector(state.view);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const amount of new Set([0, state.apart])) for (const p of placedBoards(mp, amount)) for (const f of boardFaces(p.board, p.offset)) for (const q of f.points) {
    const s = pr(q);
    x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]);
  }
  const mx = (x1 - x0) * (state.numbers ? .2 : .1) + 12, my = (y1 - y0) * .06 + 10;
  return { x0: x0 - mx, x1: x1 + mx, y0: y0 - my, y1: y1 + my };
}

/** Draws measurements, each only if its label has room: not over a label already placed (higher ranks go first) and
 * not squeezed by the angle it is seen at. */
function measureMarks(pr: (p: Vec3) => Projected, list: readonly Measure[], length: LengthText, fs: number, move: (m: Measure) => Vec3) {
  const placed: [number, number, number, number][] = [];
  let out = '';
  for (const m of [...list].sort((a, b) => a.rank - b.rank)) {
    const shift = move(m), a0 = add(m.a, shift), b0 = add(m.b, shift), pa = pr(a0), pb = pr(b0), PA = pr(add(a0, m.offset)), PB = pr(add(b0, m.offset));
    const size = m.rank === 1 ? fs : fs * .9, label = length(m.length), d = [PB[0] - PA[0], PB[1] - PA[1]], dl = Math.hypot(d[0]!, d[1]!);
    const tw = label.length * size * .62 + size * .5, th = size * 1.25;
    if (dl < Math.min(tw, th * 2.2)) continue;
    let e = [PA[0] - pa[0], PA[1] - pa[1]], el = Math.hypot(e[0]!, e[1]!);
    if (el < 1e-6) { e = [-d[1]! / dl, d[0]! / dl]; if (e[1]! > 0) e = [-e[0]!, -e[1]!]; el = 0; } else e = [e[0]! / el, e[1]! / el];
    const cx = (PA[0] + PB[0]) / 2 + e[0]! * size * .75, cy = (PA[1] + PB[1]) / 2 + e[1]! * size * .75;
    const box: [number, number, number, number] = [cx - tw / 2, cy - th / 2, cx + tw / 2, cy + th / 2];
    if (placed.some(q => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) continue;
    placed.push(box);
    const k = size * .32, u = [d[0]! / dl, d[1]! / dl], tick = (p: Projected) =>
      line([p[0] - (u[0]! + e[0]!) * k * .7, p[1] - (u[1]! + e[1]!) * k * .7, 0], [p[0] + (u[0]! + e[0]!) * k * .7, p[1] + (u[1]! + e[1]!) * k * .7, 0], 'mk-dim');
    if (el) out += line(pa, [PA[0] + e[0]! * k, PA[1] + e[1]! * k, 0], 'mk-ext') + line(pb, [PB[0] + e[0]! * k, PB[1] + e[1]! * k, 0], 'mk-ext');
    out += `<g class="mk-measure r${m.rank}">` + line(PA, PB, 'mk-dim') + tick(PA) + tick(PB)
      + `<text class="mk-dimtx" font-size="${n2(size)}" x="${n2(cx)}" y="${n2(cy)}" text-anchor="middle" dominant-baseline="central">${label}</text></g>`;
  }
  return out;
}

/** Taken apart: each part's size written on its first board, where it faces the viewer most. */
function sizeLabels(pr: (p: Vec3) => Projected, placed: readonly Placed[], length: LengthText, fs: number, solidFronts: boolean) {
  const seen = new Set<number>(), boxes: [number, number, number, number][] = [];
  let out = '';
  for (const { part, board: b, offset } of placed) {
    if (seen.has(part.n) || (isFront(part) && !solidFronts)) continue;
    seen.add(part.n);
    const thin = thinAxis(b), c: Vec3 = thin === 'z' ? [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1] : thin === 'y' ? [(b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) / 2] : [b.x1, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
    const q = pr(add(c, offset)), label = `${length(part.cut.length)}×${length(part.cut.width)}`, size = fs * .78, tw = label.length * size * .62;
    const box: [number, number, number, number] = [q[0] - tw / 2, q[1] - size * .65, q[0] + tw / 2, q[1] + size * .65];
    if (boxes.some(r => box[0] < r[2] && box[2] > r[0] && box[1] < r[3] && box[3] > r[1])) continue;
    boxes.push(box);
    out += `<text class="mk-plab" font-size="${n2(size)}" x="${n2(q[0])}" y="${n2(q[1])}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  }
  return out;
}

/** Part numbers in two columns beside the model, each with a leader to a dot on its part. */
function numberMarks(pr: (p: Vec3) => Projected, placed: readonly Placed[], frame: ReturnType<typeof modelFrame>, fs: number, selected: number | null) {
  const anchors: { n: number; x: number; y: number; tx?: number; ty?: number; left?: boolean }[] = [], seen = new Set<number>();
  for (const { part, board: b, offset } of placed) {
    if (seen.has(part.n)) continue;
    seen.add(part.n);
    const thin = thinAxis(b), at: Vec3 = thin === 'y' ? [(b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) * .5 + (b.z1 - b.z0) * .3] : [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1];
    const s = pr(add(at, offset));
    anchors.push({ n: part.n, x: s[0], y: s[1] });
  }
  const mid = (frame.x0 + frame.x1) / 2, r = fs * .95, gap = r * 2.5;
  let out = '';
  for (const left of [true, false]) {
    const column = anchors.filter(a => (a.x < mid) === left).sort((a, b) => a.y - b.y);
    let y = frame.y0 + r;
    for (const a of column) { a.ty = Math.max(a.y, y); y = a.ty + gap; }
    let limit = frame.y1 - r;
    for (const a of [...column].reverse()) { a.ty = Math.min(a.ty!, limit); limit = a.ty - gap; }
    for (const a of column) {
      const tx = left ? frame.x0 + r : frame.x1 - r, edge = left ? tx + r : tx - r, elbow = left ? edge + r * 1.2 : edge - r * 1.2;
      out += `<g class="mk-tag${selected === a.n ? ' sel' : ''}" data-n="${a.n}"><polyline class="mk-lead" points="${n2(a.x)},${n2(a.y)} ${n2(elbow)},${n2(a.ty!)} ${n2(edge)},${n2(a.ty!)}"/>`
        + `<circle class="mk-ldot" cx="${n2(a.x)}" cy="${n2(a.y)}" r="${n2(fs * .22)}"/><circle class="mk-tagc" cx="${n2(tx)}" cy="${n2(a.ty!)}" r="${n2(r)}"/>`
        + `<text class="mk-tagt" font-size="${n2(fs * .9)}" x="${n2(tx)}" y="${n2(a.ty!)}" text-anchor="middle" dominant-baseline="central">${a.n}</text></g>`;
    }
  }
  return out;
}

/** The model as SVG: the boards painted far to near, then the measurements for what is shown, then part numbers.
 * `textSize` is the label size in drawing units (13 screen pixels at the current zoom); absent, it follows the frame. */
export function modelSvg(mp: MakePiece, state: ModelState, length: LengthText, shades: PartShades = new Map(), textSize?: number) {
  const pr = projector(state.view), frame = modelFrame(mp, state), placed = placedBoards(mp, state.apart);
  const w = frame.x1 - frame.x0, h = frame.y1 - frame.y0, fs = textSize ?? Math.max(w * .018, h * .026);
  const faces = placed.map(p => boardFaces(p.board, p.offset)), o = pr([0, 0, 0]);
  const screen = faces.map(list => {
    const pts = list.flatMap(f => f.points.map(pr));
    return { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) };
  });
  const order = paintOrder(placed.map(p => boundsOf(p.board, p.offset)), state.view, screen);
  let boards = '';
  for (const i of order) {
    const { part } = placed[i]!, phantom = isFront(part) && !state.solidFronts, shade = shades.get(part.n);
    const cls = ['mk-part', phantom ? 'phantom' : '', part.stock === 'back' ? 'back' : '', state.selected === part.n ? 'sel' : ''].filter(Boolean).join(' ');
    const style = shade ? ` style="--ft:${shade.ft};--ff:${shade.ff};--fs:${shade.fs}"` : '';
    boards += `<g class="${cls}" data-n="${part.n}"${style}>`;
    for (const f of faces[i]!) if (pr(f.normal)[2] - o[2] > 1e-6) boards += `<polygon class="mk-f ${f.shade}" points="${f.points.map(q => P(pr(q))).join(' ')}"/>`;
    boards += '</g>';
  }
  let marks = '';
  if (state.measures) {
    const selected = state.selected === null ? null : mp.parts.find(p => p.n === state.selected) ?? null;
    if (selected) {
      const offsets = new Map(placed.filter(p => p.part === selected).map(p => [p.board, p.offset]));
      marks = measureMarks(pr, partMeasures(selected, state.apart < .05), length, fs, () => offsets.get(selected.boards[0]!) ?? [0, 0, 0]);
    } else if (state.apart < .05) {
      marks = measureMarks(pr, pieceMeasures(mp), length, fs, () => [0, 0, 0]);
    } else marks = sizeLabels(pr, placed, length, fs, state.solidFronts);
  }
  const numbers = state.numbers || (state.apart >= .05 && !state.measures) ? numberMarks(pr, placed, frame, fs, state.selected) : '';
  return { viewBox: [frame.x0, frame.y0, w, h].map(n2).join(' '), markup: `<g class="mk-boards">${boards}</g><g class="mk-marks">${marks}${numbers}</g>`,
    selected: state.selected !== null };
}
