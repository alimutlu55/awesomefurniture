import { cutWithBand, type MakePiece } from '../../domain/make/make-parts';
import type { LengthText } from './make-marks';
import { partSheetSvg, partTileSvg } from './make-sheet';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const BANDS = [0, .4, 1, 2] as const;

/** What the panel shows: every part, or one part with its drawing. */
export interface PanelView {
  readonly piece: MakePiece;
  readonly selected: number | null;
  readonly band: number;
  readonly length: LengthText;
  readonly material: (decorId: string) => string;
}

/** The parts of the piece, one row each: its shape to scale, number, name, how many, and its size. */
export function partsList({ piece, length }: PanelView) {
  return `<div class="make-rows">${piece.parts.map(p => `<button type="button" class="make-row" data-n="${p.n}">${partTileSvg(p, 28)}`
    + `<span class="make-n">${p.n}</span><span class="make-name" translate="no">${esc(p.name)}${p.boards.length > 1 ? ` <small>×${p.boards.length}</small>` : ''}</span>`
    + `<b>${length(p.cut.length)} × ${length(p.cut.width)}</b></button>`).join('')}</div>`
    + '<button type="button" class="make-wide" data-set>Full drawing set</button>';
}

/** One part: its size, its cut size after edge banding and its decor, its flat drawing, and the banding to take off. */
export function partDetail({ piece, selected, band, length, material }: PanelView) {
  const part = piece.parts.find(p => p.n === selected);
  if (!part) return '';
  const cut = cutWithBand(part, band), decor = material(part.decorId), banded = part.edges !== '—';
  return `<div class="make-size" translate="no">${length(part.cut.length)} × ${length(part.cut.width)} × ${length(part.cut.thickness)}</div>`
    + `<p class="make-sub">${part.boards.length > 1 ? `×${part.boards.length} · ` : ''}${esc(decor)}${banded && band ? ` · cut ${length(cut.length)} × ${length(cut.width)}` : ''}</p>`
    + partSheetSvg(part, length, decor, band, true)
    + (banded ? `<div class="make-line"><span>Edge banding</span><span class="unit-seg" role="group" aria-label="Edge banding taken off the cut size">`
      + BANDS.map(v => `<button type="button" data-band="${v}" aria-pressed="${band === v}">${v}</button>`).join('') + '</span></div>' : '')
    + '<div class="make-line make-steps"><button type="button" data-step="-1">Previous</button><button type="button" data-step="1">Next</button></div>';
}
