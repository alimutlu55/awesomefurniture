import { flatFrame, flatHoles, type FlatHole } from '../../domain/make/make-assembly';
import { bandedEdges, cutWithBand, type MakePart, type MakePiece } from '../../domain/make/make-parts';
import { thinAxis } from '../../domain/make/make-measures';
import type { LengthText } from './make-marks';

/** A part's face as it lies flat, in centimetres: length across, width up. A back or front cut to a slope keeps its
 * outline (seen from the front); every other board is its cutting rectangle. */
function faceOutline(part: MakePart): { x: number; y: number }[] {
  const b = part.boards[0]!;
  if (b.outline && thinAxis(b) === 'z') {
    const x0 = Math.min(...b.outline.map(p => p.x)), y0 = Math.min(...b.outline.map(p => p.y));
    return b.outline.map(p => ({ x: p.x - x0, y: p.y - y0 }));
  }
  const { length, width } = part.cut;
  return [{ x: 0, y: 0 }, { x: length, y: 0 }, { x: length, y: width }, { x: 0, y: width }];
}
const n2 = (v: number) => v.toFixed(2);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** The banded edges of a flat part, as segments of its outline: the long edge at the front first, then the others. */
function bandedSides(part: MakePart, pts: readonly { x: number; y: number }[]) {
  const { long, short } = bandedEdges(part.edges);
  const sides = pts.map((p, k) => [p, pts[(k + 1) % pts.length]!] as const);
  const length = (s: typeof sides[number]) => Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y);
  const longest = [...sides].sort((a, b) => length(b) - length(a)), longs = longest.slice(0, 2), shorts = longest.slice(2, 4);
  return [...longs.sort((a, b) => Math.min(a[0].y, a[1].y) - Math.min(b[0].y, b[1].y)).slice(0, long), ...shorts.slice(0, short)];
}

/** What is drilled and grooved in a part, as it lies flat on the sheet: holes in millimetres from its corner (the face
 * with the most blind holes turned up), grooves as bands in centimetres. */
export interface SheetDrilling { readonly holes: readonly FlatHole[]; readonly grooves: readonly { u0: number; u1: number; v0: number; v1: number }[] }
export function partDrilling(piece: MakePiece, part: MakePart): SheetDrilling {
  const b = part.boards[0]!, i = part.ids[0]!;
  if (b.outline && thinAxis(b) === 'z') return { holes: [], grooves: [] };
  const flat = flatHoles(b, piece.holes.filter(h => h.board === i)), L = b.cut.length * 10;
  const blind = (face: string) => flat.filter(h => h.face === face && h.depth > 0).length;
  // Turned over end for end, so the long front edge stays at the bottom of the drawing.
  const over = blind('-') > blind('+'), swap = { '+': '-', '-': '+', u0: 'u1', u1: 'u0', v0: 'v0', v1: 'v1' } as const;
  const holes = over ? flat.map(h => ({ ...h, u: Math.round((L - h.u) * 10) / 10, face: swap[h.face] })) : flat;
  const { along, across } = flatFrame(b), lo = [b.x0, b.y0, b.z0], len = b.cut.length;
  const grooves = piece.grooves.filter(g => g.board === i).map(g => {
    const u0 = g.lo[along] - lo[along]!, u1 = g.hi[along] - lo[along]!;
    return { u0: over ? len - u1 : u0, u1: over ? len - u0 : u1, v0: g.lo[across] - lo[across]!, v1: g.hi[across] - lo[across]! };
  });
  return { holes, grooves };
}
const NONE: SheetDrilling = { holes: [], grooves: [] };

/** A part lying flat, drawn to scale: its face with banded edges and grain, its two edges seen end on, its overall
 * sizes, and a title strip with what to cut. `bandMm` is the edge banding taken off the cut size. */
export function partSheetSvg(part: MakePart, length: LengthText, material: string, bandMm: number, compact = false, drilling = NONE) {
  const pts = faceOutline(part), L = Math.max(...pts.map(p => p.x)), Wd = Math.max(...pts.map(p => p.y)), T = part.cut.thickness;
  // Compact (in a panel): a narrower sheet, so its figures read at the panel's width.
  // Holes are measured from the corner along the top and down the left: room for those figures.
  const drilled = drilling.holes.some(h => h.face === '+' || h.face === '-'), VW = compact ? 400 : 680, VH = compact ? 230 : 360;
  const x0 = compact ? (drilled ? 48 : 24) : (drilled ? 90 : 70), base = compact ? (drilled ? 160 : 150) : 230;
  const s = Math.min((compact ? (drilled ? 266 : 290) : 460) / L, (compact ? (drilled ? 110 : 115) : 160) / Wd);
  const X = (x: number) => x0 + x * s, Y = (y: number) => base - y * s, w = L * s, h = Wd * s, te = Math.max(T * s, 6);
  const ln = (a: number, b: number, c: number, d: number, cls = 'mk-ps-dim') => `<line class="${cls}" x1="${n2(a)}" y1="${n2(b)}" x2="${n2(c)}" y2="${n2(d)}"/>`;
  const tx = (x: number, y: number, t: string, cls = 'mk-ps-tx', rot = 0) =>
    `<text class="${cls}" x="${n2(x)}" y="${n2(y)}" text-anchor="middle"${rot ? ` transform="rotate(${rot} ${n2(x)} ${n2(y)})"` : ''}>${t}</text>`;
  let g = `<svg class="mk-ps${compact ? ' compact' : ''}" viewBox="0 0 ${VW} ${VH}" role="img" translate="no" aria-label="${esc(part.name)}, ${length(part.cut.length)} by ${length(part.cut.width)} by ${length(T)}">`;
  g += `<polygon class="mk-ps-face" points="${pts.map(p => n2(X(p.x)) + ',' + n2(Y(p.y))).join(' ')}"/>`;
  for (const [a, b] of bandedSides(part, pts)) g += ln(X(a.x), Y(a.y), X(b.x), Y(b.y), 'mk-ps-band');
  const gy = Y(Wd / 2), gx = X(L / 2);
  g += `<path class="mk-ps-grain" d="M${n2(gx - 34)} ${n2(gy)}h68m-8 -3.5l8 3.5-8 3.5"/>`;
  g += drillingSvg(drilling, X, Y, s, L, Wd, te, base, compact);
  // The front edge seen end on, under the face, and the end edge beside it: how thick, and whether banded.
  const ey = base + 14, ex = X(L) + 14, longBand = bandedEdges(part.edges).long > 0, shortBand = bandedEdges(part.edges).short > 0;
  g += `<rect class="mk-ps-edge${longBand ? ' banded' : ''}" x="${n2(x0)}" y="${n2(ey)}" width="${n2(w)}" height="${n2(te)}"/>`;
  g += `<rect class="mk-ps-edge${shortBand ? ' banded' : ''}" x="${n2(ex)}" y="${n2(Y(Wd))}" width="${n2(te)}" height="${n2(h)}"/>`;
  g += ln(X(L) + 4, ey, X(L) + 11, ey) + ln(X(L) + 4, ey + te, X(L) + 11, ey + te) + tx(X(L) + 22, ey + te / 2 + 4, length(T));
  // Overall sizes: length under everything, width beside everything; a slope's two heights at its ends.
  const dy = ey + te + 22, dx = ex + te + 18;
  g += ln(x0, ey + te + 4, x0, dy + 4, 'mk-ps-ext') + ln(X(L), ey + te + 4, X(L), dy + 4, 'mk-ps-ext') + ln(x0, dy, X(L), dy)
    + ln(x0 - 3, dy + 3, x0 + 3, dy - 3) + ln(X(L) - 3, dy + 3, X(L) + 3, dy - 3) + tx(x0 + w / 2, dy - 5, length(L), 'mk-ps-tx big');
  g += ln(ex + te + 4, Y(Wd), dx + 4, Y(Wd), 'mk-ps-ext') + ln(ex + te + 4, Y(0), dx + 4, Y(0), 'mk-ps-ext') + ln(dx, Y(Wd), dx, Y(0))
    + ln(dx - 3, Y(Wd) + 3, dx + 3, Y(Wd) - 3) + ln(dx - 3, Y(0) + 3, dx + 3, Y(0) - 3) + tx(dx + 12, Y(Wd / 2), length(Wd), 'mk-ps-tx big', 90);
  if (pts.length !== 4 || pts.some(p => p.x > 0 && p.x < L)) {
    const at = (x: number) => Math.max(...pts.filter(p => Math.abs(p.x - x) < .01).map(p => p.y), 0);
    for (const x of [0, L]) if (at(x) > 0 && Math.abs(at(x) - Wd) > .05) g += tx(X(x) + (x ? -14 : 14), Y(at(x) / 2), length(at(x)), 'mk-ps-tx', -90);
  }
  if (!compact) {
    const cut = cutWithBand(part, bandMm), ty = VH - 34;
    const cells: [string, number][] = [[String(part.n), 30], [esc(part.name), 130], ['×' + part.boards.length, 44],
      [`${length(part.cut.length)} × ${length(part.cut.width)} × ${length(T)}`, 160], [esc(material), 120], [part.edges, 50],
      [`✂ ${length(cut.length)} × ${length(cut.width)}`, 122]];
    let cx = 12;
    g += `<rect class="mk-ps-title" x="12" y="${ty}" width="${VW - 24}" height="24"/>`;
    cells.forEach(([t, wd], i) => { if (i) g += ln(cx, ty, cx, ty + 24, 'mk-ps-rule'); g += tx(cx + wd / 2, ty + 16, t, i ? 'mk-ps-cell' : 'mk-ps-cell b'); cx += wd; });
  }
  return g + '</svg>';
}

/**
 * Holes and grooves on a flat part: on the face turned up, a ring (a dot in it for a blind hole, filled for one right
 * through); on the face under it, a dashed ring; in an edge, a tick on that edge seen end on. Over the face, every
 * distinct hole position measured from the corner along the top and down the side (ordinates, millimetres).
 */
function drillingSvg(d: SheetDrilling, X: (x: number) => number, Y: (y: number) => number, s: number, L: number, Wd: number, te: number, base: number, compact: boolean) {
  let g = '';
  for (const gr of d.grooves) g += `<rect class="mk-ps-groove" x="${n2(X(gr.u0))}" y="${n2(Y(gr.v1))}" width="${n2((gr.u1 - gr.u0) * s)}" height="${n2(Math.max(1.5, (gr.v1 - gr.v0) * s))}"/>`;
  const us = new Set<number>(), vs = new Set<number>();
  for (const h of d.holes) {
    const r = Math.max(1.6, h.d / 20 * s), x = X(h.u / 10), y = Y(h.v / 10);
    if (h.face === '+' || h.face === '-') {
      const cls = h.face === '-' ? 'mk-ps-hole under' : h.depth === 0 ? 'mk-ps-hole through' : 'mk-ps-hole';
      g += `<circle class="${cls}" cx="${n2(x)}" cy="${n2(y)}" r="${n2(r)}"/>`;
      if (h.face === '+' && h.depth > 0 && r > 2.5) g += `<circle class="mk-ps-hole-c" cx="${n2(x)}" cy="${n2(y)}" r=".9"/>`;
      us.add(h.u); vs.add(h.v);
    } else if (h.face === 'v0' || h.face === 'v1') g += `<line class="mk-ps-hole-edge" x1="${n2(x)}" y1="${n2(base + 14)}" x2="${n2(x)}" y2="${n2(base + 14 + te)}"/>`;
    else g += `<line class="mk-ps-hole-edge" x1="${n2(X(L) + 14)}" y1="${n2(y)}" x2="${n2(X(L) + 14 + te)}" y2="${n2(y)}"/>`;
  }
  // Ordinates: a short tick and the distance from the corner, skipping any that would touch the one before.
  const fs = compact ? 13 : 9, gap = fs + 2, top = Y(Wd) - 4, left = X(0) - 4;
  let last = -Infinity;
  for (const u of [...us].sort((a, b) => a - b)) {
    const x = X(u / 10);
    if (x - last < gap) continue;
    last = x;
    g += `<line class="mk-ps-ext" x1="${n2(x)}" y1="${n2(top)}" x2="${n2(x)}" y2="${n2(top - 4)}"/><text class="mk-ps-ord" x="${n2(x)}" y="${n2(top - 6)}" transform="rotate(-90 ${n2(x)} ${n2(top - 6)})">${mmText(u)}</text>`;
  }
  last = Infinity;
  for (const v of [...vs].sort((a, b) => a - b)) {
    const y = Y(v / 10);
    if (last - y < gap) continue;
    last = y;
    g += `<line class="mk-ps-ext" x1="${n2(left)}" y1="${n2(y)}" x2="${n2(left + 4)}" y2="${n2(y)}"/><text class="mk-ps-ord end" x="${n2(left - 2)}" y="${n2(y + fs / 3)}">${mmText(v)}</text>`;
  }
  return g;
}
const mmText = (v: number) => String(Math.round(v * 10) / 10);

/** Holes counted by size: diameter, depth (⟂ right through) and how many, for the line under a part's drawing. */
export function drillingSummary(d: SheetDrilling): { d: number; depth: number; qty: number }[] {
  const lines = new Map<string, { d: number; depth: number; qty: number }>();
  for (const h of d.holes) { const key = h.d + '|' + h.depth, line = lines.get(key) ?? { d: h.d, depth: h.depth, qty: 0 }; line.qty++; lines.set(key, line); }
  return [...lines.values()].sort((a, b) => b.d - a.d || b.depth - a.depth);
}

/** A part as a small flat shape for the parts strip: to scale, with its banded edges. */
export function partTileSvg(part: MakePart, height = 34) {
  const pts = faceOutline(part), L = Math.max(...pts.map(p => p.x)), Wd = Math.max(...pts.map(p => p.y));
  const s = Math.min(108 / L, (height - 6) / Wd), ox = (120 - L * s) / 2, oy = (height + Wd * s) / 2;
  const P = (p: { x: number; y: number }) => n2(ox + p.x * s) + ',' + n2(oy - p.y * s);
  let g = `<svg viewBox="0 0 120 ${height}" aria-hidden="true"><polygon class="mk-tile-face" points="${pts.map(P).join(' ')}"/>`;
  for (const [a, b] of bandedSides(part, pts)) g += `<line class="mk-tile-band" x1="${P(a).split(',')[0]}" y1="${P(a).split(',')[1]}" x2="${P(b).split(',')[0]}" y2="${P(b).split(',')[1]}"/>`;
  return g + '</svg>';
}
