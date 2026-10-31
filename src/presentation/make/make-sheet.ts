import { bandedEdges, cutWithBand, type MakePart } from '../../domain/make/make-parts';
import { thinAxis } from '../../domain/make/make-measures';
import type { LengthText } from './make-scene';

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

/** A part lying flat, drawn to scale: its face with banded edges and grain, its two edges seen end on, its overall
 * sizes, and a title strip with what to cut. `bandMm` is the edge banding taken off the cut size. */
export function partSheetSvg(part: MakePart, length: LengthText, material: string, bandMm: number, compact = false) {
  const pts = faceOutline(part), L = Math.max(...pts.map(p => p.x)), Wd = Math.max(...pts.map(p => p.y)), T = part.cut.thickness;
  const VW = 680, VH = compact ? 290 : 360, x0 = 70, base = compact ? 200 : 230, s = Math.min(480 / L, (compact ? 150 : 175) / Wd);
  const X = (x: number) => x0 + x * s, Y = (y: number) => base - y * s, w = L * s, h = Wd * s, te = Math.max(T * s, 6);
  const ln = (a: number, b: number, c: number, d: number, cls = 'mk-ps-dim') => `<line class="${cls}" x1="${n2(a)}" y1="${n2(b)}" x2="${n2(c)}" y2="${n2(d)}"/>`;
  const tx = (x: number, y: number, t: string, cls = 'mk-ps-tx', rot = 0) =>
    `<text class="${cls}" x="${n2(x)}" y="${n2(y)}" text-anchor="middle"${rot ? ` transform="rotate(${rot} ${n2(x)} ${n2(y)})"` : ''}>${t}</text>`;
  let g = `<svg class="mk-ps" viewBox="0 0 ${VW} ${VH}" role="img" translate="no" aria-label="${esc(part.name)}, ${length(part.cut.length)} by ${length(part.cut.width)} by ${length(T)}">`;
  g += `<polygon class="mk-ps-face" points="${pts.map(p => n2(X(p.x)) + ',' + n2(Y(p.y))).join(' ')}"/>`;
  for (const [a, b] of bandedSides(part, pts)) g += ln(X(a.x), Y(a.y), X(b.x), Y(b.y), 'mk-ps-band');
  const gy = Y(Wd / 2), gx = X(L / 2);
  g += `<path class="mk-ps-grain" d="M${n2(gx - 34)} ${n2(gy)}h68m-8 -3.5l8 3.5-8 3.5"/>`;
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

/** A part as a small flat shape for the parts strip: to scale, with its banded edges. */
export function partTileSvg(part: MakePart, height = 34) {
  const pts = faceOutline(part), L = Math.max(...pts.map(p => p.x)), Wd = Math.max(...pts.map(p => p.y));
  const s = Math.min(108 / L, (height - 6) / Wd), ox = (120 - L * s) / 2, oy = (height + Wd * s) / 2;
  const P = (p: { x: number; y: number }) => n2(ox + p.x * s) + ',' + n2(oy - p.y * s);
  let g = `<svg viewBox="0 0 120 ${height}" aria-hidden="true"><polygon class="mk-tile-face" points="${pts.map(P).join(' ')}"/>`;
  for (const [a, b] of bandedSides(part, pts)) g += `<line class="mk-tile-band" x1="${P(a).split(',')[0]}" y1="${P(a).split(',')[1]}" x2="${P(b).split(',')[0]}" y2="${P(b).split(',')[1]}"/>`;
  return g + '</svg>';
}
