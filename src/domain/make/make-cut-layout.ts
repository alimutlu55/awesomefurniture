import { cutWithBand, bandedEdges, type MakePart } from './make-parts';
import { hasGrain, STOCK } from './stock-sheet';

/**
 * The cut layout: every part placed on stock boards, as a panel saw cuts them. Boards of one decor and thickness share
 * stock sheets 2800 × 2070 mm, trimmed 10 mm all round, with a 4 mm saw kerf between parts. Parts are laid in strips
 * across the sheet (guillotine cuts: rip the strip, then cross-cut its parts), longest grain along the sheet's length;
 * a part may turn only when its decor has no grain. Millimetres throughout.
 */

export { STOCK };

export interface Placed { readonly n: number; readonly x: number; readonly y: number; readonly l: number; readonly w: number; readonly turned: boolean }
export interface StockSheet { readonly decorId: string; readonly thickness: number; readonly parts: readonly Placed[]; readonly used: number }
export interface CutLayout {
  readonly sheets: readonly StockSheet[];
  /** Parts larger than a stock sheet: to be ordered cut to size or joined. */
  readonly oversize: readonly number[];
  /** Edge banding to buy, metres per decor, with 2 cm over at each end of every edge. */
  readonly band: readonly { decorId: string; metres: number }[];
}

interface Piece { n: number; l: number; w: number; grain: boolean }
interface Strip { y: number; h: number; x: number }
interface Open { decorId: string; thickness: number; strips: Strip[]; parts: Placed[]; y: number }

export function cutLayout(parts: readonly MakePart[], stock = STOCK, bandMm = 0): CutLayout {
  const L = stock.length - 2 * stock.trim, W = stock.width - 2 * stock.trim, k = stock.kerf, sheets: Open[] = [], oversize: number[] = [];
  const groups = new Map<string, { decorId: string; thickness: number; pieces: Piece[] }>();
  for (const p of parts) {
    const thickness = Number((p.cut.thickness * 10).toPrecision(12)), key = p.decorId + '|' + thickness, g = groups.get(key) ?? { decorId: p.decorId, thickness, pieces: [] };
    const grain = hasGrain(p.decorId), cut = cutWithBand(p, bandMm);
    for (let i = 0; i < p.boards.length; i++) g.pieces.push({ n: p.n, l: cut.length * 10, w: cut.width * 10, grain });
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    // Widest first, then longest: a strip is as deep as the first part in it, and the rest fill along it.
    const pieces = g.pieces.map(p => !p.grain && p.w > p.l ? { ...p, l: p.w, w: p.l, turned: true } : { ...p, turned: false })
      .sort((a, b) => b.w - a.w || b.l - a.l);
    const mine: Open[] = [];
    for (const p of pieces) {
      const fit = p.l <= L && p.w <= W ? p : !p.grain && p.w <= L && p.l <= W ? { ...p, l: p.w, w: p.l, turned: !p.turned } : null;
      if (!fit) { oversize.push(p.n); continue; }
      const place = (sheet: Open, strip: Strip) => { sheet.parts.push({ n: fit.n, x: strip.x, y: strip.y, l: fit.l, w: fit.w, turned: fit.turned }); strip.x += fit.l + k; };
      let done = false;
      for (const sheet of mine) {
        const strip = sheet.strips.find(s => fit.w <= s.h && s.x + fit.l <= L);
        if (strip) { place(sheet, strip); done = true; break; }
        if (sheet.y + fit.w <= W) { const s = { y: sheet.y, h: fit.w, x: 0 }; sheet.strips.push(s); sheet.y += fit.w + k; place(sheet, s); done = true; break; }
      }
      if (!done) {
        const sheet: Open = { decorId: g.decorId, thickness: g.thickness, strips: [], parts: [], y: 0 }, s = { y: 0, h: fit.w, x: 0 };
        sheet.strips.push(s); sheet.y = fit.w + k; place(sheet, s); mine.push(sheet);
      }
    }
    sheets.push(...mine);
  }
  const band = new Map<string, number>();
  for (const p of parts) {
    const e = bandedEdges(p.edges), metres = p.boards.length * (e.long * (p.cut.length + 4) + e.short * (p.cut.width + 4)) / 100;
    if (metres > 0) band.set(p.decorId, (band.get(p.decorId) ?? 0) + metres);
  }
  return {
    sheets: sheets.map(s => ({ decorId: s.decorId, thickness: s.thickness, parts: s.parts.map(p => ({ ...p, x: p.x + stock.trim, y: p.y + stock.trim })),
      used: s.parts.reduce((a, p) => a + p.l * p.w, 0) / (stock.length * stock.width) })),
    oversize, band: [...band].map(([decorId, metres]) => ({ decorId, metres: Math.round(metres * 10) / 10 })),
  };
}
