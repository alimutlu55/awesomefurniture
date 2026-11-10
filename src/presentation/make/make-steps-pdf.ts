import { TOOLS } from '../../domain/hardware/tools';
import { stepNotes } from '../../domain/make/make-instructions';
import type { MakePiece } from '../../domain/make/make-parts';
import { box, type Mark, type Pt, shape, words } from '../drawings/paper-marks';
import type { PdfImage } from '../drawings/pdf-writer';
import type { StepPicture } from './make-pictures';
import { countText, partText, runnerText } from './assembly-notes';
import { instructionFor, stageName } from './assembly-studio';

/**
 * The steps as a flat-pack manual prints them, two to an A3 page: each with its number and name, its pictures from the
 * film (the step done, and a close-up of a joint with the fasteners going in; make-pictures.ts), the instruction, the
 * tools, the hardware with sizes, a drawer's kit, the parts by number, where the runners go and what not to do. Paper
 * millimetres, y down.
 */
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

/** A picture fitted in a box, centred across and set at its top; null without one. */
function placed(shot: { width: number; height: number } | null | undefined, x0: number, y0: number, w: number, h: number) {
  if (!shot) return null;
  const k = Math.min(w / shot.width, h / shot.height), pw = shot.width * k, ph = shot.height * k;
  return { x: x0 + (w - pw) / 2, y: y0, w: pw, h: ph };
}
/** The close-up of a joint in its frame, each fastener's way in dashed with a ring at its hole. */
function detailMarks(d: NonNullable<StepPicture['detail']>, at: { x: number; y: number; w: number; h: number }): Mark[] {
  const marks: Mark[] = [box(at.x, at.y, at.x + at.w, at.y + at.h, 'outline')];
  const inside = (p: Pt) => p.x >= at.x && p.x <= at.x + at.w && p.y >= at.y && p.y <= at.y + at.h;
  for (const way of d.ways) {
    const a = P(at.x + way.from[0] * at.w, at.y + way.from[1] * at.h), b = P(at.x + way.to[0] * at.w, at.y + way.to[1] * at.h);
    if (inside(a) && inside(b)) marks.push(shape([a, b], 'hidden'));
    if (inside(b)) marks.push({ kind: 'circle', c: b, r: .9, pen: 'cut', fill: 'white' });
  }
  return marks;
}

/** One step in its half of the page: number and name, the step done across the top, then the close-up of a joint and the
 * words beside it. Without pictures, the words take the cell. */
function stepCell(piece: MakePiece, k: number, x0: number, y0: number, w: number, h: number, shown?: StepPicture): { marks: Mark[]; images: PdfImage[] } {
  const step = piece.steps[k]!, notes = stepNotes(piece, k), cargo = piece.fittings.some(f => f.size?.includes('cargo'));
  const out: Mark[] = [words(P(x0, y0 + 8), String(step.n), 'project'), words(P(x0 + 13, y0 + 7.5), stageName(step.stage, cargo), 'caption')];
  const images: PdfImage[] = [];
  const whole = placed(shown?.whole, x0, y0 + 12, w, h * .55);
  if (whole && shown?.whole) images.push({ ...whole, ...shown.whole });
  const top = whole ? whole.y + whole.h + 6 : y0 + 16, side = Math.min(w * .42, y0 + h - top);
  const detail = shown?.detail && side > 30 ? { x: x0, y: top, w: side, h: side } : null;
  if (detail && shown?.detail) { images.push({ ...detail, ...shown.detail }); out.push(...detailMarks(shown.detail, detail)); }
  const tx = detail ? x0 + detail.w + 6 : x0, tw = w - (tx - x0);
  let y = top + 3;
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
  return { marks: out, images };
}

/** The step pages, two steps a page side by side, with each step's pictures when there are any. */
export function stepPages(piece: MakePiece, area: { x: number; y: number; w: number; h: number }, pictures?: readonly StepPicture[]): { heading: string; marks: Mark[]; images: PdfImage[] }[] {
  const pages: { heading: string; marks: Mark[]; images: PdfImage[] }[] = [], cw = area.w / 2;
  for (let k = 0; k < piece.steps.length; k += 2) {
    const marks: Mark[] = [], images: PdfImage[] = [];
    for (let j = 0; j < 2 && k + j < piece.steps.length; j++) {
      const x = area.x + j * cw;
      if (j) marks.push(shape([P(x - 2, area.y), P(x - 2, area.y + area.h - 4)], 'rule'));
      const cell = stepCell(piece, k + j, x + 2, area.y + 2, cw - 8, area.h - 6, pictures?.[k + j]);
      marks.push(...cell.marks); images.push(...cell.images);
    }
    pages.push({ heading: 'Steps', marks, images });
  }
  return pages;
}
