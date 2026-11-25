import { PIECE_PRESETS, type PiecePreset } from '../../domain/furniture/piece-presets';
import { esc } from './editor-format.js';


/** A preset's card: its front to scale in the Add sheet's product style, drawers as rows or a pair of doors. */
export function piecePresetArt(preset: PiecePreset): string {
  const W = 146, H = 110, pad = 14, { w, h } = preset.size, scale = Math.min((W - 2 * pad - 10) / w, (H - 2 * pad) / 130);
  const fw = w * scale, fh = h * scale, x = (W - fw) / 2 - 5, y = H - pad - fh, legs = 4;
  const rows = preset.look === 'drawers' ? Math.max(2, Math.min(4, Math.round(h / 22))) : 0;
  const fronts = preset.look === 'doors'
    ? `<path d="M${(x + fw / 2).toFixed(1)} ${(y + 3).toFixed(1)}v${(fh - legs - 6).toFixed(1)}" stroke="#9c7b52" stroke-width="1.4"/>`
      + `<path d="M${(x + fw / 2 - 5).toFixed(1)} ${(y + fh / 2).toFixed(1)}v8m10-8v8" stroke="#7d6040" stroke-width="1.6"/>`
    : Array.from({ length: rows }, (_, k) => {
      const ry = y + 3 + (fh - legs - 6) * (k + 1) / rows, cy = y + 3 + (fh - legs - 6) * (k + .5) / rows;
      return (k < rows - 1 ? `<path d="M${(x + 3).toFixed(1)} ${ry.toFixed(1)}h${(fw - 6).toFixed(1)}" stroke="#9c7b52" stroke-width="1.2"/>` : '')
        + `<path d="M${(x + fw / 2 - 7).toFixed(1)} ${cy.toFixed(1)}h14" stroke="#7d6040" stroke-width="1.8" stroke-linecap="round"/>`;
    }).join('');
  const side = `<path d="M${(x + fw).toFixed(1)} ${(y + fh).toFixed(1)}l10 -6V${(y - 6).toFixed(1)}L${(x + fw).toFixed(1)} ${y.toFixed(1)}Z" fill="#ad8a5e"/>`;
  const top = `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l10 -6h${fw.toFixed(1)}l-10 6Z" fill="#e0c49b"/>`;
  return `<svg class="product-art shape-art" viewBox="0 0 ${W} ${H}" aria-hidden="true">${side}${top}`
    + `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${fw.toFixed(1)}" height="${fh.toFixed(1)}" fill="#d9bd91" stroke="#9c7b52" stroke-width="1.6"/>${fronts}</svg>`;
}

/** One Add-sheet card per preset, tagged with its category (furniture-taxonomy.ts). */
export const piecePresetButtons = () => PIECE_PRESETS.map(p => `<button type="button" class="shape-product" data-add-piece="${p.id}" data-product-category="${p.category}" hidden`
  + ` title="${esc(p.name + ' · ' + p.description)}">${piecePresetArt(p)}<span>${esc(p.name)}</span></button>`).join('');
