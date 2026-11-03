import type { CutLayout } from '../../domain/make/make-cut-layout';
import { cutWithBand, type MakePiece } from '../../domain/make/make-parts';
import type { LengthText } from './make-marks';
import type { MakePlayer } from './make-player';
import { cuttingTab, hardwareDisplay, hardwareTab, fittingIcon, type PanelTab, tabsHtml } from './make-panel-tabs';
import { drillingSummary, partDrilling, partSheetSvg, partTileSvg } from './make-sheet';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const BANDS = [0, .4, 1, 2] as const;

/** What the panel shows: every part, or one part with its drawing. */
export interface PanelView {
  readonly piece: MakePiece;
  readonly selected: number | null;
  readonly band: number;
  readonly length: LengthText;
  readonly material: (decorId: string) => string;
  readonly tab: PanelTab;
  /** The assembly film's player. */
  readonly player: MakePlayer;
  /** The cut layout, made when the Cutting tab is first shown. */
  readonly cut: () => CutLayout;
}

/** The piece as a whole, by tab: its parts, its hardware, how it goes together, how it is cut. */
export function pieceTabs(view: PanelView) {
  const body = view.tab === 'hardware' ? hardwareTab(view.piece)
    : view.tab === 'cutting' ? cuttingTab(view.cut(), view.material) : partsList(view);
  return tabsHtml(view.tab) + '<button type="button" class="make-studio-shortcut" data-assembly><span class="make-studio-symbol">▷</span>'
    + '<span><b>Assembly Studio</b><small>Watch and explore, step by step.</small></span><span>›</span></button>' + body;
}

/** The parts of the piece, one row each: its shape to scale, number, name, how many, and its size. */
function partsList({ piece, length }: PanelView) {
  const partsRows = `<div class="make-rows">${piece.parts.map(p => `<button type="button" class="make-row" data-n="${p.n}">${partTileSvg(p, 28)}`
    + `<span class="make-n">${p.n}</span><span class="make-name" translate="no">${esc(p.name)}${p.boards.length > 1 ? ` <small>×${p.boards.length}</small>` : ''}</span>`
    + `<b>${length(p.cut.length)} × ${length(p.cut.width)}</b></button>`).join('')}</div>`;

  const hardwareRows = piece.buy.length
    ? `<div class="make-line" style="margin-top:12px"><span>Hardware &amp; Components</span><span><b>${piece.buy.reduce((s, b) => s + b.qty, 0)} items</b></span></div>`
      + `<div class="make-rows">${piece.buy.map(b => {
        const disp = hardwareDisplay(b);
        return `<button type="button" class="make-row make-buy" data-hardware="${b.kind}" data-size="${esc(b.size ?? '')}" title="View assembly stages">`
          + `${fittingIcon(b.kind)}<span class="make-name">${esc(disp.name)}`
          + `${disp.size ? ` <small translate="no">${esc(disp.size)}</small>` : ''}</span><b>×${b.qty}</b></button>`;
      }).join('')}</div>`
    : '';

  return partsRows + hardwareRows
    + '<div class="make-line make-steps"><button type="button" data-save="pdf">Drawings</button><button type="button" data-set>Full drawing set</button></div>';
}

/** One part: its size, its cut size after edge banding and its decor, its flat drawing, and the banding to take off. */
export function partDetail({ piece, selected, band, length, material }: PanelView) {
  const part = piece.parts.find(p => p.n === selected);
  if (!part) return '';
  const cut = cutWithBand(part, band), decor = material(part.decorId), banded = part.edges !== '—', drilling = partDrilling(piece, part);
  const holes = drillingSummary(drilling);
  return `<button type="button" class="make-studio-shortcut" data-assembly-part="${part.n}">View this assembly stage <span>→</span></button>`
    + `<div class="make-size" translate="no">${length(part.cut.length)} × ${length(part.cut.width)} × ${length(part.cut.thickness)}</div>`
    + `<p class="make-sub">${part.boards.length > 1 ? `×${part.boards.length} · ` : ''}${esc(decor)}${banded && band ? ` · cut ${length(cut.length)} × ${length(cut.width)}` : ''}</p>`
    + partSheetSvg(part, length, decor, band, true, drilling)
    + (holes.length ? `<div class="make-chips" translate="no">${holes.map(h => `<span class="make-chip"><svg class="make-ico" viewBox="0 0 24 24" aria-hidden="true">`
      + `<circle cx="12" cy="12" r="6"${h.depth ? '' : ' class="through"'}/></svg><span>Ø${h.d}${h.depth ? ' · ' + h.depth : ''} ×${h.qty}</span></span>`).join('')}</div>` : '')
    + (banded ? `<div class="make-line"><span>Edge banding</span><span class="unit-seg" role="group" aria-label="Edge banding taken off the cut size">`
      + BANDS.map(v => `<button type="button" data-band="${v}" aria-pressed="${band === v}">${v}</button>`).join('') + '</span></div>' : '')
    + '<div class="make-line make-steps"><button type="button" data-step="-1">Previous</button><button type="button" data-step="1">Next</button></div>';
}
