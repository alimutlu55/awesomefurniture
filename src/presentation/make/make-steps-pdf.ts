import { TOOLS } from '../../domain/hardware/tools';
import { drawerBenches, posePoint, type DrawerPose } from '../../domain/make/drawer-film';
import { entryOf } from '../../domain/make/make-fixing';
import { stepNotes } from '../../domain/make/make-instructions';
import type { Vec3 } from '../../domain/make/make-measures';
import type { MakePiece } from '../../domain/make/make-parts';
import { type Mark, type Pt, shape, words } from '../drawings/paper-marks';
import { countText, partText, runnerText } from './assembly-notes';
import { instructionFor, stageName } from './assembly-studio';

/**
 * The steps as a flat-pack manual prints them, four to an A3 page: each with its number and name, a drawing of what it
 * adds (the parts it puts in drawn heavy and shaded, what is built already in thin line, a ring where each fitting goes),
 * the instruction, the tools, the hardware with sizes, a drawer's kit, the parts by number, where the runners go and
 * what not to do. A drawer box is drawn as it is built, its front lying face down. Paper millimetres, y down.
 */
const BOX_STAGES: ReadonlySet<string> = new Set(['drawer-boxes', 'drawer-sides', 'drawer-back']);
const P = (x: number, y: number): Pt => ({ x, y });

/** Lines of at most `width` mm of `size` mm lettering (Helvetica's average letter is about half its size). */
export function wrap(text: string, width: number, size: number): string[] {
  const most = Math.max(8, Math.floor(width / (size * .5))), out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > most) { out.push(line); line = word; } else line = line ? line + ' ' + word : word;
  }
  return line ? [...out, line] : out;
}

/** A step's drawing: boards as solids in an oblique view (fronts true, depth going back up and right), back to front. */
function picture(piece: MakePiece, k: number, x0: number, y0: number, w: number, h: number): Mark[] {
  const step = piece.steps[k]!, box = BOX_STAGES.has(step.stage), drawer = piece.drawers?.[0];
  // A drawer box is drawn alone (the first; the rest are alike or listed), lying on its front as it is built.
  const bench = box && drawer ? drawerBenches(piece)[0]! : null, turn: DrawerPose | null = bench ? { angle: Math.PI / 2, ref: bench.ref, at: [0, 0, 0] } : null;
  const own = drawer ? [drawer.front, drawer.bottom, drawer.back, ...drawer.sides] : [];
  const boxEarly = new Set((piece.drawers ?? []).flatMap(d => [d.front, d.bottom, d.back, ...d.sides]));
  const install = piece.steps.findIndex(s => s.stage === 'drawers');
  const stepOf = new Map(piece.steps.flatMap((s, i) => s.boards.map(b => [b, i] as const)));
  const shown = piece.boards.map((_, i) => i).filter(i => {
    const at = stepOf.get(i);
    if (at === undefined || at > k) return false;
    if (box) return own.includes(i);
    // Boxes go into the cabinet when the drawers go on.
    return !boxEarly.has(i) || k >= install;
  });
  const D = piece.size.d, place = (p: Vec3): Vec3 => turn ? posePoint(turn, p) : p;
  const corners = (i: number) => { const b = piece.boards[i]!; const out: Vec3[] = []; for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) out.push(place([x, y, z])); return out; };
  const flat = (p: Vec3) => { const back = (turn ? 0 : D) - p[2]; return [p[0] + back * .45, p[1] + back * .32] as const; };
  const all = shown.flatMap(corners).map(flat), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  if (!all.length) return [];
  const s = Math.min((w - 6) / (Math.max(...xs) - Math.min(...xs) || 1), (h - 6) / (Math.max(...ys) - Math.min(...ys) || 1));
  const cx = x0 + w / 2 - (Math.max(...xs) + Math.min(...xs)) / 2 * s, cy = y0 + h / 2 + (Math.max(...ys) + Math.min(...ys)) / 2 * s;
  const pt = (p: Vec3) => { const [u, v] = flat(p); return P(cx + u * s, cy - v * s); };
  const out: Mark[] = [];
  // Back to front: seen from the front, right and above, a board is drawn before one that can hide it: one beyond it
  // (right of, above or in front of it) along some axis, and behind it along none.
  const bounds = new Map(shown.map(i => { const q = corners(i); return [i, [0, 1, 2].map(a => [Math.min(...q.map(p => p[a]!)), Math.max(...q.map(p => p[a]!))] as const)] as const; }));
  const before = (a: number, b: number) => {
    const A = bounds.get(a)!, B = bounds.get(b)!, beyond = (P: typeof A, Q: typeof A) => [0, 1, 2].some(k => P[k]![1] <= Q[k]![0] + 1e-6);
    return beyond(A, B) && !beyond(B, A);
  };
  const order: number[] = [], left = new Set(shown);
  while (left.size) {
    const next = [...left].find(a => ![...left].some(b => b !== a && before(b, a))) ?? [...left][0]!;
    order.push(next); left.delete(next);
  }
  for (const i of order) {
    const q = corners(i), lo = [0, 1, 2].map(a => Math.min(...q.map(p => p[a]!))), hi = [0, 1, 2].map(a => Math.max(...q.map(p => p[a]!)));
    const v = (x: number, y: number, z: number) => pt([x, y, z]), mine = stepOf.get(i) === k;
    const fill = mine ? 'laminated' as const : 'white' as const, pen = mine ? 'outline' as const : 'thin' as const;
    out.push(shape([v(lo[0]!, hi[1]!, hi[2]!), v(hi[0]!, hi[1]!, hi[2]!), v(hi[0]!, hi[1]!, lo[2]!), v(lo[0]!, hi[1]!, lo[2]!)], pen, true, fill),
      shape([v(hi[0]!, lo[1]!, hi[2]!), v(hi[0]!, lo[1]!, lo[2]!), v(hi[0]!, hi[1]!, lo[2]!), v(hi[0]!, hi[1]!, hi[2]!)], pen, true, fill),
      shape([v(lo[0]!, lo[1]!, hi[2]!), v(hi[0]!, lo[1]!, hi[2]!), v(hi[0]!, hi[1]!, hi[2]!), v(lo[0]!, hi[1]!, hi[2]!)], pen, true, fill));
  }
  // Where each fitting of the step goes: on the drawn drawer only, for a box step.
  for (const i of step.items) {
    const e = entryOf(piece, i);
    if (!e || (box && (e.board === null || !own.includes(e.board)))) continue;
    out.push({ kind: 'circle', c: pt(place(e.at)), r: .9, pen: 'cut', fill: 'white' });
  }
  return out;
}

/** One step in its cell: number and name over the drawing, the words beside it. */
function stepCell(piece: MakePiece, k: number, x0: number, y0: number, w: number, h: number): Mark[] {
  const step = piece.steps[k]!, notes = stepNotes(piece, k), cargo = piece.fittings.some(f => f.size?.includes('cargo'));
  const out: Mark[] = [words(P(x0, y0 + 7), String(step.n), 'project'), words(P(x0 + 12, y0 + 6.5), stageName(step.stage, cargo), 'caption')];
  const pw = w * .52, tx = x0 + pw + 4, tw = w - pw - 4;
  out.push(...picture(piece, k, x0, y0 + 10, pw, h - 12));
  let y = y0 + 6;
  const write = (text: string, font: 'note' | 'small' | 'list' | 'listMark' | 'check' | 'head', size: number, gap = 1.25) => {
    for (const l of wrap(text, tw, size)) { if (y > y0 + h - 2) return; out.push(words(P(tx, y), l, font)); y += size * gap; }
  };
  write(instructionFor(step.stage, cargo), 'note', 3); y += 1.5;
  if (notes.tools.length) { write('Tools: ' + notes.tools.map(t => TOOLS[t].name).join(' · '), 'listMark', 2.7); y += 1; }
  if (step.fittings.length) write('Hardware: ' + step.fittings.map(countText).join(' · '), 'list', 2.7);
  for (const kit of notes.kits) write(`${kit.drawers > 1 ? `Each of ${kit.drawers} drawers` : 'One drawer'}: ${kit.each.map(countText).join(' · ')}`, 'list', 2.7);
  const parts = piece.parts.filter(p => p.ids.some(id => step.boards.includes(id)));
  if (parts.length) write('Parts: ' + parts.map(p => `${partText(piece, p)} ×${p.ids.filter(id => step.boards.includes(id)).length}`).join(', '), 'list', 2.7);
  for (const r of notes.runners) write(runnerText(r), 'small', 2.4);
  if (notes.avoid.length) y += 1;
  // Crossed out, as the manual crosses out the wrong way (× is in the PDF's Helvetica; a ✕ is not).
  for (const a of notes.avoid) write('× ' + a, 'check', 2.9);
  return out;
}

/** The step pages, four steps a page. */
export function stepPages(piece: MakePiece, area: { x: number; y: number; w: number; h: number }): { heading: string; marks: Mark[] }[] {
  const pages: { heading: string; marks: Mark[] }[] = [], cw = area.w / 2, ch = area.h / 2;
  for (let k = 0; k < piece.steps.length; k += 4) {
    const marks: Mark[] = [];
    for (let j = 0; j < 4 && k + j < piece.steps.length; j++) {
      const x = area.x + (j % 2) * cw, y = area.y + Math.floor(j / 2) * ch;
      if (j % 2) marks.push(shape([P(x - 2, y), P(x - 2, y + ch - 4)], 'rule'));
      if (j > 1) marks.push(shape([P(x, y - 2), P(x + cw - 6, y - 2)], 'rule'));
      marks.push(...stepCell(piece, k + j, x + 2, y + 2, cw - 8, ch - 8));
    }
    pages.push({ heading: 'Steps', marks });
  }
  return pages;
}
