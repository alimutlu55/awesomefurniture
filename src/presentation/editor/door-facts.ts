import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { cabinetDoorLeaves, leafGlass } from '../../domain/wardrobe/door-layout';
import { leafKey, madeStyle } from '../../domain/wardrobe/front-styles';
import { hinge, hingeFor, hingesFor, hingeStations } from '../../domain/wardrobe/hinges';
import { handleLabel, handlePlacement, resolveHandle } from '../../domain/wardrobe/handles';
import { resolveMaterials } from '../../domain/materials/configured-materials';
import { decorBadge, getDecor } from '../../domain/materials/decor-catalog';
import { mm } from '../../domain/drawings/drawing';
import { isFrontBoard, piecefronts } from '../../domain/drawings/fronts';
import { cornerFaceWidths } from '../../domain/drawings/corner-widths';
import { pieceBoards } from '../../domain/drawings/unit-detail';
import { placePieces, type DrawingInput } from '../../domain/drawings/room-pieces';
import { RULES } from '../../domain/drawings/manufacturing-rules/index';

/** One door leaf's facts, as the hardware list and the rules have them. Millimetres, except `hinges.at` and the drawing's
 * own centimetres. */
export interface DoorFacts {
  readonly key: string;
  readonly width: number; readonly height: number; readonly thickness: number;
  readonly decor: string;
  readonly hinges: { readonly name: string; readonly count: number; readonly softClose: boolean; readonly angle: number; readonly side: 'left' | 'right';
    /** Centres up from the leaf's bottom edge, mm. */
    readonly at: readonly number[] };
  /** The handle as the hardware list names it, or push-to-open; where its centre is on the leaf (mm from its bottom left). */
  readonly handle: { readonly label: string; readonly x: number; readonly y: number } | null;
  /** A handle-rail door's grip, by its style's name, in place of a handle. */
  readonly grip?: string | undefined;
  /** The engineering rules' word on this leaf: none, or the worst finding's severity, its rule and fix. */
  readonly status: { readonly severity: 'ok' | 'warning' | 'critical'; readonly rule?: string | undefined; readonly fix?: string | undefined };
}

/**
 * A chosen door leaf's facts (P1-11), from the same functions the hardware list and the manufacturing rules use, so the
 * panel never says other than the lists: its cut size and decor, its hinges (kind, how many for its height, soft-close,
 * opening angle, where each is), its handle, and what the rules say about it. Null when the piece has no such leaf.
 */
export function doorFacts(input: DrawingInput, wardrobe: number, key: string): DoorFacts | null {
  const pieces = placePieces(input), p = pieces.find(x => x.id === wardrobe);
  if (!p || p.design.doors === 'none') return null;
  const d = p.design, editing = { ...d, sel: 0, item: -1, divider: -1, space: null };
  const leaf = cabinetDoorLeaves(d, createWardrobeGeometry(() => editing).widths()).find(l => leafKey(l.bay, l.row, l.leaf) === key);
  const front = leaf && piecefronts(d, cornerFaceWidths(p, pieces)).fronts.find(f => f.opens === 'side' && Math.abs(f.x0 - leaf.x0) < .01 && Math.abs(f.y0 - leaf.y0) < .01);
  if (!leaf || !front) return null;
  const boards = pieceBoards(p, pieces), index = boards.findIndex(b => (b.stock === 'door' || b.stock === 'front') && isFrontBoard(front, b)), board = boards[index];
  const height = (board ? board.y1 : front.y1) - front.y0, materials = resolveMaterials(d);
  const kind = hinge(hingeFor(front, d, front.glass ?? leafGlass(d, leaf), p.sides)), handle = resolveHandle(materials), made = madeStyle({ ...d, materials }, leaf.decorId);
  const place = handlePlacement({ x0: front.x0, x1: front.x1, y0: front.y0, y1: front.y0 + height, door: true, hinge: front.hinge }, handle);
  const findings = RULES.flatMap(rule => rule(input, pieces)).filter(f => f.at?.mark === p.mark && f.at.board === index);
  const worst = findings.find(f => f.severity === 'critical') ?? findings[0];
  return {
    key, width: mm(front.x1 - front.x0), height: mm(height), thickness: board ? Math.round(board.cut.thickness * 10) : 0,
    decor: decorBadge(getDecor(leaf.decorId ?? materials.frontDecorId)),
    hinges: { name: kind.name, count: hingesFor(mm(height)), softClose: kind.softClose, angle: kind.angle, side: front.hinge ?? 'left',
      at: hingeStations(height).map(y => Math.round(y * 10)) },
    ...(made.grip ? { handle: null, grip: made.name } : { handle: handle.none ? null : { label: handleLabel(handle), x: mm(place.x - front.x0), y: mm(place.y - front.y0) } }),
    status: worst ? { severity: worst.severity, rule: worst.rule, fix: worst.fix } : { severity: 'ok' },
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** The leaf drawn small, seen from the front: its outline, a mark at each hinge on its hinge edge and the handle, then its
 * facts as labels and numbers. Markup for the toolbar's own popover, in the editor's ink and line colours. */
export function doorFactsHtml(f: DoorFacts): string {
  const H = 132, k = H / f.height, W = Math.max(24, f.width * k), left = f.hinges.side === 'left';
  const hinges = f.hinges.at.map(y => `<rect x="${(left ? 2 : W - 8).toFixed(1)}" y="${(H - y * k - 3).toFixed(1)}" width="6" height="6" rx="3" fill="currentColor"/>`).join('');
  const handle = f.handle ? `<rect x="${(f.handle.x * k - 1.5).toFixed(1)}" y="${(H - f.handle.y * k - 9).toFixed(1)}" width="3" height="18" rx="1.5" fill="currentColor"/>` : '';
  // Numbers and names stay as they are; words are the editor's to translate. Labels muted, values in ink.
  const row = (label: string, value: string, literal = true) => `<span style="color:var(--mute,#7d725f)">${esc(label)}</span><b${literal ? ' translate="no"' : ''} style="font-weight:600">${esc(value)}</b>`;
  const tone = { ok: ['#2f6b3c', '#2f6b3c1a'], warning: ['#8a5a00', '#c58a1a24'], critical: ['#a3271c', '#c4382a1f'] }[f.status.severity];
  const badge = f.status.severity === 'ok' ? 'OK' : f.status.severity === 'warning' ? 'Check' : 'Problem';
  const chip = `display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;color:${tone[0]};background:${tone[1]}`;
  const why = f.status.severity === 'ok' ? '' : `<span style="grid-column:1/-1;font-size:11.5px;line-height:1.4;color:var(--mute,#7d725f)">${esc(f.status.rule ?? '')}`
    + `${f.status.fix ? `<br><b style="color:var(--ink)">${esc(f.status.fix)}</b>` : ''}</span>`;
  return `<div class="door-facts" data-door-facts="${esc(f.key)}" style="display:flex;gap:16px;align-items:flex-start;color:var(--ink);min-width:min(380px,calc(100vw - 72px))">`
    + `<svg viewBox="-1 -1 ${(W + 2).toFixed(1)} ${H + 2}" width="${(W + 2).toFixed(0)}" height="${H + 2}" role="img" aria-label="Door" style="flex:none">`
    + `<rect x="0" y="0" width="${W.toFixed(1)}" height="${H}" rx="1.5" fill="var(--panel)" stroke="currentColor" stroke-width="1"/>${hinges}${handle}</svg>`
    + `<div style="display:grid;grid-template-columns:max-content 1fr;gap:7px 14px;font-size:12.5px;align-items:baseline;flex:1">`
    + row('Size', `${f.width} × ${f.height} × ${f.thickness} mm`) + row('Decor', f.decor)
    + row('Hinges', `${f.hinges.count} × ${f.hinges.name}`) + row('Soft-close', f.hinges.softClose ? 'Yes' : 'No', false)
    + row('Opens', `${f.hinges.angle}°`) + row('Hinged', f.hinges.side === 'left' ? 'Left' : 'Right', false)
    + row('Handle', f.grip ?? f.handle?.label ?? 'Push-to-open', !!f.handle)
    + `<span style="color:var(--mute,#7d725f)">Rules</span><span><b data-status="${f.status.severity}" style="${chip}">${badge}</b></span>`
    + why + `</div></div>`;
}
