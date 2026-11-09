import { CARGO_MECHANISM_ENTRY, hardware } from '../../domain/hardware/hardware-registry';
import type { FittingKind } from '../../domain/make/make-joints';
import type { CutLayout } from '../../domain/make/make-cut-layout';
import { STOCK } from '../../domain/make/make-cut-layout';
import { JOINT_SYSTEMS, BACK_FIXINGS } from '../../domain/make/make-construction';
import type { MakePiece } from '../../domain/make/make-parts';
import type { Stage } from '../../domain/make/make-assembly';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Hardware by what it is called and drawn as: a small line icon (24 × 24) beside its name. */
export const FITTING_NAMES: Record<FittingKind, string> = {
  confirmat: 'Connector screw', cam: 'Cam connector', bolt: 'Cam bolt', dowel: 'Dowel', screw: 'Screw', nail: 'Nail', pin: 'Shelf pin', hinge: 'Hinge',
  plate: 'Hinge plate', runner: 'Runners, pair', handle: 'Handle', rail: 'Hanging rail', support: 'Rail support', leg: 'Leg',
  hanger: 'Hangers, pair', bracket: 'Wall bracket', drawerLock: 'Drawer lock',
};
const ICONS: Record<FittingKind, string> = {
  confirmat: 'M8 4h8M12 4v14l-2 2M12 7l3 1-6 2 6 2-6 2 6 2', screw: 'M8 4h8M12 4v14l-2 2M12 7l3 1-6 2 6 2-6 2 6 2',
  cam: 'M12 4a8 8 0 1 0 .01 0zM8 12h8', bolt: 'M9 3h6M12 3v18M10 8l4 1M10 11l4 1M10 14l4 1M10 17l4 1', dowel: 'M5 10h14v4H5zM8 10v4M11 10v4M14 10v4', nail: 'M8 4h8M12 4v16', pin: 'M9 6h6v5H9zM12 11v8',
  hinge: 'M7 12a4 4 0 1 0 .01 0zM11 12h9M16 9v6', plate: 'M5 8h14v8H5zM9 12h.01M15 12h.01', runner: 'M3 9h18v6H3zM3 12h18',
  handle: 'M5 9h14M7 9v6M17 9v6', rail: 'M3 10h18v4H3z', support: 'M8 6v8a4 4 0 0 0 8 0V6', leg: 'M9 4h6v13H9zM8 20h8',
  hanger: 'M5 6h14v5H5zM9 11l3 6 3-6', bracket: 'M7 4v16h10', drawerLock: 'M4 10h16v3H4zM12 13v4M9 17h7',
};
export const fittingIcon = (kind: FittingKind) => `<svg class="make-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[kind]}"/></svg>`;
/** A size as sold: millimetres when it is a bare number ("550 mm"), as written otherwise ("7 × 50", "110°"). */
export const sold = (size?: string) => !size ? '' : /^\d+$/.test(size) ? size + ' mm' : size.replace(/^(\d[\d ×.]*)$/, '$1 mm');

/** Formats hardware items into readable titles and dimensions for buy lists, tables, and chips. */
export function hardwareDisplay(b: { kind: FittingKind; size?: string }): { name: string; size: string } {
  if (b.size?.includes('cargo frame') || (b.kind === 'support' && b.size?.includes('cargo'))) {
    const v = CARGO_MECHANISM_ENTRY.variants?.find(x => x.key === 'frame');
    return { name: v?.name ?? 'Cargo pull-out frame', size: 'steel chassis + 4 slide brackets (2–3 pręt)' };
  }
  if (b.size?.includes('cargo basket')) {
    const style = b.size.includes('solid') ? 'solid Arena' : 'wire';
    return { name: `Cargo ${style} basket`, size: 'clip-on basket + Separator divider' };
  }
  if ((b.kind === 'bracket' || b.kind === 'plate') && b.size?.includes('cargo')) {
    return { name: 'Cargo front bracket', size: '103.5×36.5 mm 3D + GTV move' };
  }
  if (b.kind === 'screw' && b.size === 'M4 × 6') {
    const v = CARGO_MECHANISM_ENTRY.variants?.find(x => x.key === 'slide-lock');
    return { name: v?.name ?? 'Slide locking screw', size: 'M4 × 6 mm machine screw' };
  }
  // A pair, left and right: the size is the rails' length. Nothing is said of the extension or a soft close the runner
  // registry does not give (bottom-mounted with a rear hook and front lock; a cargo pull-out's slides say theirs in its steps).
  if (b.kind === 'runner' && b.size) return { name: 'Drawer runners, left and right', size: `${b.size} mm pair` };
  return { name: FITTING_NAMES[b.kind] ?? hardware(b.kind)?.display.listLine.label ?? b.kind, size: sold(b.size) };
}

export const TABS = [['parts', 'Parts'], ['hardware', 'Hardware'], ['cutting', 'Cutting']] as const;
export type PanelTab = typeof TABS[number][0];
export const tabsHtml = (tab: PanelTab) => `<div class="unit-seg make-tabs" role="group" aria-label="Show">${TABS
  .map(([key, label]) => `<button type="button" data-tab="${key}" aria-pressed="${tab === key}">${label}</button>`).join('')}</div>`;

const JOINT_LABELS: Record<typeof JOINT_SYSTEMS[number], string> = { confirmat: 'Screws', cam: 'Cams', dowel: 'Dowels' };
const BACK_LABELS: Record<typeof BACK_FIXINGS[number], string> = { nailed: 'Nailed', grooved: 'Grooved' };
/** What is wrong with the drilling, as a short label. */
const FINDINGS = { clash: 'Holes overlap', edge: 'Near the edge', breakout: 'Through the face', meet: 'Holes meet' } as const;

/** How it goes together (joints, back), whether the drilling checks out, and everything to buy, counted. */
export function hardwareTab(piece: MakePiece) {
  const seg = (label: string, key: string, values: readonly string[], labels: Record<string, string>, now: string) =>
    `<div class="make-line"><span>${label}</span><span class="unit-seg" role="group" aria-label="${label}">${values
      .map(v => `<button type="button" data-${key}="${v}" aria-pressed="${now === v}">${labels[v]}</button>`).join('')}</span></div>`;
  const partOf = (board: number) => piece.parts.find(p => p.ids.includes(board))!;
  const checks = piece.findings.length
    ? piece.findings.slice(0, 6).map((f, k) => { const p = partOf(f.board); return `<button type="button" class="make-row make-check bad" data-n="${p.n}" data-finding="${k}">`
      + `<span class="make-mark" aria-hidden="true">!</span><span class="make-n">${p.n}</span><span class="make-name" translate="no">${esc(p.name)}</span>`
      + `<b><span>${FINDINGS[f.kind]}</span> · ${Math.abs(f.gap)} mm</b></button>`; }).join('')
    : '<div class="make-row make-check ok"><span class="make-mark" aria-hidden="true">✓</span><span></span><span class="make-name">Drilling checked</span><b></b></div>';
  return seg('Joints', 'joints', JOINT_SYSTEMS, JOINT_LABELS, piece.construction.joints)
    + seg('Back', 'back', BACK_FIXINGS, BACK_LABELS, piece.construction.back)
    + `<div class="make-rows">${checks}</div>`
    + `<div class="make-rows">${piece.buy.map(b => {
      const disp = hardwareDisplay(b);
      return `<button type="button" class="make-row make-buy" data-hardware="${b.kind}" data-size="${esc(b.size ?? '')}" title="View assembly stages">`
        + `${fittingIcon(b.kind)}<span class="make-name">${esc(disp.name)}`
        + `${disp.size ? ` <small translate="no">${esc(disp.size)}</small>` : ''}</span><b>×${b.qty}</b></button>`;
    }).join('')}</div>`;
}

/** What each step does, as its chapter is called. */
export const STAGE_NAMES: Record<Stage, string> = {
  plinth: 'Plinth', carcass: 'Base and sides', partitions: 'Partitions', top: 'Top', back: 'Back', inside: 'Inside',
  'drawer-boxes': 'Drawer fronts and bottoms', 'drawer-sides': 'Drawer sides', 'drawer-back': 'Drawer backs',
  'drawer-runners': 'Mount runners', 'cargo-frame': 'Prepare cargo frame', 'cargo-baskets': 'Hook on cargo baskets', drawers: 'Put drawers on', 'drawer-lock': 'Lock drawers', 'drawer-test': 'Test drawer travel',
  fronts: 'Fronts', doors: 'Doors', wall: 'Fix to the wall',
};
/** Every stock sheet, its parts drawn on it to scale and numbered, how much of it is used; then the banding to buy. */
export function cuttingTab(layout: CutLayout, material: (decorId: string) => string) {
  const W = 360, s = W / STOCK.length, H = STOCK.width * s, count = new Map<string, number>();
  const sheets = layout.sheets.map(sheet => {
    const key = sheet.decorId + sheet.thickness, k = (count.get(key) ?? 0) + 1, of = layout.sheets.filter(x => x.decorId + x.thickness === key).length;
    count.set(key, k);
    let g = `<svg class="make-stock" viewBox="0 0 ${W} ${H.toFixed(1)}" role="img" aria-label="${esc(material(sheet.decorId))}, ${sheet.thickness} mm, sheet ${k} of ${of}">`
      + `<rect class="make-stock-sheet" x="0" y="0" width="${W}" height="${H.toFixed(1)}"/>`;
    for (const p of sheet.parts) {
      const x = p.x * s, y = p.y * s, w = p.l * s, h = p.w * s;
      g += `<rect class="make-stock-part" data-n="${p.n}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
      if (w > 14 && h > 10) g += `<text class="make-stock-n" x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2 + 3.5).toFixed(1)}">${p.n}</text>`;
    }
    return `<div class="make-line"><span translate="no">${esc(material(sheet.decorId))} · ${sheet.thickness} mm</span><span>${k}/${of} · ${Math.round(sheet.used * 100)}%</span></div>${g}</svg>`;
  }).join('');
  const oversize = layout.oversize.length ? `<p class="make-sub">Longer than a sheet: ${[...new Set(layout.oversize)].join(', ')}</p>` : '';
  const band = layout.band.map(b => `<div class="make-line"><span><span>Edge banding</span> · <span translate="no">${esc(material(b.decorId))}</span></span><b>${b.metres} m</b></div>`).join('');
  return `<p class="make-sub" translate="no">${STOCK.length} × ${STOCK.width} mm · ✂ ${STOCK.kerf} mm</p>${sheets}${oversize}${band}`
    + '<div class="make-line make-steps"><button type="button" data-save="csv">Cut list</button><button type="button" data-save="pdf">Drawings</button></div>';
}
