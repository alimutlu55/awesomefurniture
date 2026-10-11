import { packStorageBoxes, storageBoxSize } from './storage-boxes';
import { SHELF_POSSESSIONS, unitsOnShelf } from '../wardrobe/possessions';
import { plannerLimits } from '../wardrobe/fittings';
import { PANEL as CATALOG_PANEL, PLINTH } from '../wardrobe/catalog.js';

/* WardrobePlanner: cm, bottom-to-top stacks. Empty space is intentional and
 * never counted as seasonal storage. Every candidate is measured the same way and must clear the same quality floor.
 * A "priority" (best overall, best value, easiest to use, ...) only changes which measurement is weighted up while searching
 * and picking; labels are awarded afterwards from what each plan actually measures, so names never add ranking bonuses. */
export const WardrobePlanner = (() => {
  'use strict';
  // Board thickness and plinth come from the catalogue; BASE is where the first fitting starts.
  const PANEL = CATALOG_PANEL, BASE = PLINTH + CATALOG_PANEL, LIFT_TRAVEL = 65, RAIL_DROP = 6, FLOOR_CLEAR = 2, FOLD_T = 3;
  // [min, max, minWidth, minDepth, default height, price] per fitting kind, from the fittings registry.
  const LIMITS = plannerLimits();
  const KEYS = ['short', 'long', 'pants', 'folded', 'shoes', 'small'];
  // Possessions that stand on a shelf are counted from the registry: one zero capacity each.
  const SHELF_ZERO = Object.fromEntries(SHELF_POSSESSIONS.map(p => [p.key, 0]));
  // Comfort allowances (cm): short = [shirt/blouse, jacket/hoodie], long = [dress, heavy coat]; fold/shoe = width per stack/pair; stack = max folded stack height.
  const DENSITIES = { compact: { short: [3, 5.5], long: [4.5, 7.5], fold: 24, stack: 8, shoe: 20 }, comfort: { short: [4, 7], long: [6, 10], fold: 27, stack: 6, shoe: 24 }, spacious: { short: [4.8, 8.5], long: [7.5, 12], fold: 30, stack: 5, shoe: 27 } };
  const FREQ = { short: 1, long: .6, pants: .9, folded: 1, shoes: .8, small: 1 };
  let DEN = { ...DENSITIES.comfort, hang: { short: 4.75, long: 7.3 } };
  const mixHang = (a, n, x) => n > 0 ? (a[0] * (n - x) + a[1] * x) / n : a[0];
  function applyDensity(c) { const d = DENSITIES[c.density]; DEN = { ...d, hang: { short: mixHang(d.short, c.needs.short, Math.min(c.jackets, c.needs.short)), long: mixHang(d.long, c.needs.long, Math.min(c.coats, c.needs.long)) } } }
  // Reach zones: P1 60-150 (prime), P2 150-200, L 30-60, F 0-30, O >200. Accessible mode uses the 38-122 cm reach range.
  // You must see into a drawer from above, so drawers and baskets stop well below the overhead reach line (about 70% of reach; 105 cm when seated).
  const drawerMax = c => c.accessible ? 105 : Math.max(100, Math.min(135, Math.round(c.reach * .7)));
  const zoneOf = a => a > 200 ? 'O' : a > 150 ? 'P2' : a >= 60 ? 'P1' : a >= 30 ? 'L' : 'F';
  const comfort = (a, k, it, c) => { if (c.accessible) return a >= 38 && a <= 122 ? 1 : a < 38 ? .4 : .2; let v = a >= 60 && a <= 150 ? 1 : a > 150 && a <= 200 ? .7 : a > 200 ? .1 : a >= 30 ? .45 : .25; if (k === 'small') v = a >= 70 && a <= 110 ? 1 : v * .8; if (k === 'shoes' && a <= 70) v = 1; if (it.k === 'folded' && c.d > 42) v *= .85; return v };
  const DEFAULTS = { short: 24, long: 6, pants: 12, folded: 30, shoes: 8, small: 30 };
  const NAMES = { short: 'shirts and jackets', long: 'dresses and coats', pants: 'trousers', folded: 'folded clothing', shoes: 'pairs of shoes', small: 'underwear and socks' };
  const round = v => Math.round(v * 100) / 100, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // null and '' (an emptied form field) fall back like undefined; they used to become 0, which turned a blank height into a 0 cm cabinet.
  const num = (v, f) => v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : f;
  // Counts: a key that is present but blank means none; a key that is missing means use the default.
  const cnt = (v, f) => v === undefined ? f : v === null || v === '' ? 0 : num(v, f);
  // Normalized configs are remembered with their density table, so hot paths can reuse them instead of rebuilding the config on every call.
  const NORM = new WeakMap();
  const norm = raw => { const d = raw && typeof raw === 'object' ? NORM.get(raw) : undefined; if (d) { DEN = d; return raw } return normalize(raw) };
  // One source of truth for counts. The 3D scene draws with these same helpers,
  // so what you see is what is counted. Inner width = bay width minus side clearance.
  const GEO = { foldStacks: (w, drawer) => Math.max(0, Math.floor((w - (drawer ? 4 : 3) + .01) / DEN.fold)), hangCount: (w, front, d, k) => Math.max(0, Math.floor(((front ? d - 10 : w - 3) + .01) / DEN.hang[k === 'long' ? 'long' : 'short'])), spacing: k => DEN.hang[k === 'long' ? 'long' : 'short'], foldW: () => DEN.fold, shoeW: () => DEN.shoe, pantsCount: w => Math.max(0, Math.floor((w - 5 + .01) / 6)), shoePairs: w => Math.max(0, Math.floor((w - 3 + .01) / DEN.shoe)), smallCount: (w, d, h) => Math.max(0, Math.floor((w - 4 + .01) / 9)) * Math.max(0, Math.floor((d - 8 + .01) / 14)) * Math.max(1, Math.floor((h - 4 + .01) / 9)) * 2 };
  const iw = (it, w) => Math.min(w, Math.max(0, num(it && it.w, w)));
  const longMin = drop => Math.max(130, drop + RAIL_DROP + FLOOR_CLEAR);
  // Overlap-aware stacking: an item only sits on earlier items that share horizontal space with it, so side-by-side items start at the floor.
  /* Layout. Items with a numeric y are pinned: they stay exactly where they were put. The rest stack up from the floor in order,
   * flowing around pinned items. x: explicit offset, else ax (l/r), else centred. With no pins this equals the old stacking. */
  function layoutSection(items, bw) {
    const list = items || [], out = new Array(list.length), placed = [], autos = [];
    const geo = it => { const wd = iw(it, bw), h = num(it && it.h, 0), off = it && Number.isFinite(it.x) ? clamp(it.x, 0, Math.max(0, bw - wd)) : it && it.ax === 'l' ? 0 : it && it.ax === 'r' ? bw - wd : (bw - wd) / 2; return { wd, h, off } };
    const hit = (a, b) => a.x0 < b.x1 - .01 && b.x0 < a.x1 - .01, hit2 = (a, b) => hit(a, b) && a.y0 < b.y1 - .01 && b.y0 < a.y1 - .01;
    list.forEach((it, j) => { if (it && Number.isFinite(it.y)) { const g = geo(it), y0 = Math.max(0, it.y); out[j] = { x0: g.off, x1: g.off + g.wd, y0, y1: y0 + g.h, w: g.wd, off: g.off, h: g.h, pinned: true }; placed.push(out[j]) } });
    list.forEach((it, j) => {
      if (out[j]) return; const g = geo(it), r = { x0: g.off, x1: g.off + g.wd, y0: 0, y1: g.h, w: g.wd, off: g.off, h: g.h };
      for (const q of autos) if (hit(r, q) && q.y1 > r.y0) r.y0 = q.y1;
      for (let again = true; again;) { again = false; r.y1 = r.y0 + g.h; for (const q of placed) if (hit2(r, q)) { r.y0 = q.y1; again = true } }
      r.y1 = r.y0 + g.h; out[j] = r; autos.push(r); placed.push(r)
    });
    return out
  }
  /* Placement solver for dragging. Pure and deterministic: same input, same answer.
   * 1 clamp the wanted spot inside the bay and round it to the grid; 2 magnet-snap each axis to the nearest guide within tol
   * (walls, centre, floor, top, and neighbour edges to abut or align); 3 if that overlaps anything, take the nearest overlap-free
   * spot. That spot always lies on the guide lines or the wanted x/y, so searching those finds the true nearest. Returns null if nothing fits. */
  function placeItem({ bw, H, w, h, want, others = [], snap = true, tol = 2.5, grid = .5 }) {
    if (!(w > 0 && h > 0) || w > bw + .01 || h > H + .01) return null;
    const mx = Math.max(0, bw - w), my = Math.max(0, H - h), r2 = v => Math.round(v * 100) / 100, qg = v => Math.round(v / grid) * grid;
    const free = (x, y) => !others.some(o => x < o.x1 - .01 && o.x0 < x + w - .01 && y < o.y1 - .01 && o.y0 < y + h - .01);
    const xl = [0, mx, mx / 2], yl = [0, my]; for (const o of others) { xl.push(o.x1, o.x0 - w, o.x0, o.x1 - w); yl.push(o.y1, o.y0 - h, o.y0, o.y1 - h) }
    const lines = (a, max) => [...new Set(a.map(v => r2(clamp(v, 0, max))))], X = lines(xl, mx), Y = lines(yl, my);
    const magnet = (v, L) => { let b = v, d = tol + 1e-9; for (const l of L) { const e = Math.abs(l - v); if (e < d - 1e-9) { d = e; b = l } } return b };
    let dx = clamp(qg(num(want && want.x, 0)), 0, mx), dy = clamp(qg(num(want && want.y, 0)), 0, my); if (snap) { dx = magnet(dx, X); dy = magnet(dy, Y) }
    let best = null;
    for (const x of [dx, ...X]) for (const y of [dy, ...Y]) {
      if (!free(x, y)) continue; const c = (x - dx) ** 2 + (y - dy) ** 2;
      if (!best || c < best.c - 1e-9 || Math.abs(c - best.c) <= 1e-9 && (y < best.y - 1e-9 || Math.abs(y - best.y) <= 1e-9 && x < best.x - 1e-9)) best = { x, y, c }
    }
    if (!best) return null;
    const nr = (a, b) => Math.abs(a - b) < .01, rx = r2(best.x), ry = r2(best.y);
    return { x: rx, y: ry, pushed: best.c > .01, snapX: mx < .01 ? null : nr(rx, 0) ? 'left edge' : nr(rx, mx) ? 'right edge' : nr(rx, mx / 2) ? 'centre' : X.includes(rx) ? 'neighbour' : null, snapY: nr(ry, 0) ? 'floor' : nr(ry, my) ? 'top' : Y.includes(ry) ? 'neighbour' : null }
  }
  function stackY(section) { return layoutSection(section && section.items, num(section && section.width, 0)) }
  const occasional = it => ['seasonal', 'linen', 'luggage'].includes(it.purpose) || it.k === 'seasonal';
  function normalize(input) { const raw = input && typeof input === 'object' ? input : {}; const c = { ...raw, needs: {} }; for (const k of KEYS) c.needs[k] = Math.max(0, cnt(raw.needs?.[k], DEFAULTS[k])); Object.assign(c, { w: num(raw.w, 200), h: num(raw.h, 230), d: num(raw.d, 60), reach: clamp(num(raw.reach, 185), raw.accessible === true ? 100 : 140, 210), accessible: raw.accessible === true, density: DENSITIES[raw.density] ? raw.density : 'comfort', growth: clamp(num(raw.growth, 15), 0, 30), jackets: Math.max(0, num(raw.jackets, 0)), coats: Math.max(0, num(raw.coats, 0)), longDrop: clamp(num(raw.longDrop, 160), 130, 185), upper: ['none', 'auto', 'more', 'fill'].includes(raw.upper) ? raw.upper : 'auto', drawers: ['none', 'auto', 'more'].includes(raw.drawers) ? raw.drawers : 'auto', allowLift: raw.allowLift === true, budget: Math.max(0, num(raw.budget, 0)), finFactor: Math.max(.1, num(raw.finFactor, 1)), doors: raw.doors || 'none', seasonalRule: raw.seasonalAboveReach !== false }); c.boxSize = storageBoxSize(c); c.seasonalTarget = { none: 0, auto: 2, more: 6, fill: 60 }[c.upper]; c.fill = c.upper === 'fill'; c.target = {}; for (const k of KEYS) c.target[k] = Math.ceil(c.needs[k] * (1 + c.growth / 100) - 1e-9); applyDensity(c); NORM.set(c, DEN); return c }
  const height = c => round(c.h - 11.6);
  // Shared by fitting, validation, capacities, and the UI. The slider is a
  // maximum comfortable access height. A lift also needs a reachable handle.
  function accessInfo(it, bottom, raw) {
    const c = norm(raw), top = bottom + num(it.h, 0), rail = top - 6;
    if (it.k === 'lift') { const handle = rail - LIFT_TRAVEL; return { height: round(handle), railHeight: round(rail), handleHeight: round(handle), type: 'pull-down', withinReach: handle <= c.reach + .03 && c.allowLift, label: 'Handle ' + round(handle) + ' cm · rail ' + round(rail) + ' cm' } }
    const pullout = ['drawer', 'sdrawer', 'pants', 'basket'].includes(it.k), dr = ['drawer', 'sdrawer', 'basket'].includes(it.k), lim = dr ? Math.min(c.reach, drawerMax(c)) : c.reach, high = (occasional(it) || it.purpose === 'reserve' || it.k === 'void') && !pullout;
    const access = ['short', 'long'].includes(it.k) ? rail : top;
    return { height: round(access), railHeight: ['short', 'long'].includes(it.k) ? round(rail) : null, type: high ? 'occasional' : 'daily', withinReach: high || access <= lim + .03, aboveReach: access > lim + .03, limit: dr ? lim : 0, label: (high ? 'Occasional · top ' : ['short', 'long'].includes(it.k) ? 'Rail ' : 'Contents top ') + round(access) + ' cm' }
  }
  function bound(it, c) { if (it.k === 'lift') return c.reach + LIFT_TRAVEL + 6 - BASE; if (['short', 'long'].includes(it.k)) return occasional(it) ? Infinity : c.reach + 6 - BASE; if (['drawer', 'sdrawer', 'basket'].includes(it.k)) return Math.min(c.reach, drawerMax(c)) - BASE; if (['pants'].includes(it.k) || !(occasional(it) || it.purpose === 'reserve' || it.k === 'void')) return c.reach - BASE; return Infinity }
  const seasonalHeight = c => Math.max(25, Math.ceil(c.boxSize.height + PANEL + 2));
  function minH(it, c) { return it.k === 'long' ? longMin(c.longDrop) : it.k === 'seasonal' ? seasonalHeight(c) : LIMITS[it.k][0] }
  function feasible(it, w, c) { const m = LIMITS[it.k]; if (!m) return false; if (it.k === 'lift' && !c.allowLift) return false; if (it.front) return ['short', 'long'].includes(it.k) && w >= 55 - .01 && c.d >= 35; return w >= m[2] - .01 && c.d >= m[3] - .01 }
  function item(k, p, c, w) { if ((k === 'short' || k === 'long') && c.d < 55) return w >= 55 ? { k, purpose: p, front: true } : null; if (k === 'pants' && (c.d < 50 || w < 45)) return { k: 'folded', purpose: 'pants' }; const it = { k, purpose: p }; return feasible(it, w, c) ? it : null }
  function fit(specs, w, c) {
    if (specs.some(it => !it || !feasible(it, w, c))) return null; const a = specs.map(it => ({ ...it, h: minH(it, c) })), H = height(c);
    const total = end => a.slice(0, end).reduce((s, it) => s + it.h, 0);
    const bounds = a.map((it, i) => ({ end: i + 1, max: Math.min(H, bound(it, c)) }));
    if (bounds.some(b => total(b.end) > b.max + .01)) return null;
    const order = a.map((it, i) => i).sort((i, j) => (['folded', 'drawer', 'shelf'].includes(a[j].k) ? 1 : 0) - (['folded', 'drawer', 'shelf'].includes(a[i].k) ? 1 : 0)); for (const i of order) { const it = a[i], ideal = it.k === 'seasonal' ? (c.fill && i === a.length - 1 ? LIMITS.seasonal[1] : seasonalHeight(c)) : it.k === 'folded' ? 30 : it.k === 'drawer' && it.purpose === 'folded' ? 26 : it.k === 'long' ? Math.max(longMin(c.longDrop), 160) : LIMITS[it.k][4]; let extra = Math.max(0, ideal - it.h); for (const b of bounds) if (i < b.end) extra = Math.min(extra, b.max - total(b.end)); it.h = round(it.h + Math.max(0, extra)) }
    return a;
  }
  function boxSlots(w, c) { return packStorageBoxes(w, c.d, 0, c.boxSize).capacity }
  function capacitiesOf(section, c) {
    const cap = { short: 0, long: 0, pants: 0, folded: 0, shoes: 0, small: 0, ...SHELF_ZERO, seasonalBoxes: 0, seasonalLitres: 0, drawerFolded: 0 }; let y = BASE, high = 0, maxAccess = 0, lifts = 0, en = 0, ew = 0; const P = stackY(section);
    for (const [j, it] of (section.items || []).entries()) {
      y = BASE + (P[j] ? P[j].y0 : 0); if (!it || !LIMITS[it.k]) continue; const access = accessInfo(it, y, c), w = iw(it, section.width), usable = feasible(it, w, c) && it.h >= minH(it, c) - .03 && it.h <= LIMITS[it.k][1] + .03 && access.withinReach;
      if (!occasional(it) && usable) {
        const s0 = { ...cap }; if (it.k !== 'void') maxAccess = Math.max(maxAccess, access.height); if (it.k === 'short' || it.k === 'lift') cap.short += GEO.hangCount(w, it.front, c.d);
        else if (it.k === 'long') cap.long += GEO.hangCount(w, it.front, c.d, 'long');
        else if (it.k === 'pants') cap.pants += GEO.pantsCount(w);
        else if (['drawer', 'sdrawer'].includes(it.k) && it.purpose === 'small') cap.small += GEO.smallCount(w, c.d, it.h);
        else if (['folded', 'drawer', 'shelf', 'basket'].includes(it.k) && ['pants', 'folded'].includes(it.purpose)) { const drawer = it.k === 'drawer', inner = Math.max(0, it.h - (drawer ? 5 : PANEL + 3)), each = it.purpose === 'pants' ? Math.min(6, Math.floor(inner / 4)) : Math.min(DEN.stack, Math.floor(inner / FOLD_T)), n = GEO.foldStacks(w, drawer) * each; cap[it.purpose] += n; if (drawer && it.purpose === 'folded') cap.drawerFolded += n }
        for (const held of SHELF_POSSESSIONS) if (it.k === 'shelf' && it.purpose === held.key && it.h >= held.holder.height - .03) cap[held.key] += unitsOnShelf(held.holder, w);
        if (it.k === 'shoe') cap.shoes += GEO.shoePairs(w); if (it.k === 'lift') lifts++; for (const k of KEYS) { const g = cap[k] - s0[k]; if (g > 0) { const hang = it.k === 'short' || it.k === 'long', pull = ['drawer', 'sdrawer', 'pants', 'basket'].includes(it.k), a = hang ? access.railHeight : it.k === 'lift' ? access.height : pull ? y + it.h : y + it.h / 2, f = FREQ[k] * g / Math.max(1, c.target[k]); ew += f; en += f * comfort(a, k, it, c) } }
      }
      if (occasional(it)) { const boxes = Number.isFinite(it.boxes) ? Math.max(0, Math.floor(it.boxes)) : boxSlots(w, c); cap.seasonalBoxes += boxes; const litres = w * it.h * c.d / 1000 * .75; cap.seasonalLitres += litres; if (y + it.h > c.reach) high += litres }
      y += num(it.h, 0);
    }
    cap.seasonalLitres = round(cap.seasonalLitres); return { en, ew, capacities: cap, highStorageLitres: round(high), maxDailyAccess: round(maxAccess), liftCount: lifts };
  }
  function sectionCost(section) { return (section.items || []).reduce((s, it) => { const m = it && LIMITS[it.k], ratio = section.width > 0 ? iw(it, section.width) / section.width : 1; return s + (m ? m[5] * (.6 + .4 * num(it.h, 0) / m[4]) * (.5 + .5 * ratio) : 0) }, 0) }
  function frameCost(n, c) { return (2 * c.h * c.d + 2 * c.w * c.d + Math.max(0, n - 1) * height(c) * c.d + c.w * c.h) / 10000 * 38 * c.finFactor + (c.doors === 'none' || c.doors === 'open' ? 0 : n * (c.doors === 'glass' ? 55 : 35) * c.h / 230 * c.finFactor) }
  function coverageOf(cap, c) { let sum = 0, count = 0, items = 0, covered = 0, overage = 0; const coverage = {}, shortfalls = []; for (const k of KEYS) { const need = c.target[k]; coverage[k] = need ? Math.min(1, cap[k] / need) : 1; if (need) { sum += coverage[k]; count++; items += need; covered += Math.min(need, cap[k]) } overage += Math.max(0, cap[k] - need) / Math.max(8, need); if (cap[k] < need) shortfalls.push({ key: k, needed: need, capacity: cap[k], missing: need - cap[k] }) } coverage.total = count ? .5 * sum / count + .5 * covered / items : 1; return { coverage, shortfalls, overage } }
  function analyze(layout, raw) {
    const c = norm(raw), supplied = Array.isArray(layout) ? layout : layout?.sections, sections = (Array.isArray(supplied) ? supplied : []).map(s => s && typeof s === 'object' ? { ...s, items: Array.isArray(s.items) ? s.items : [] } : { width: 0, items: [] }); const errors = [], warnings = [], reachIssues = [], H = height(c), cap = { short: 0, long: 0, pants: 0, folded: 0, shoes: 0, small: 0, ...SHELF_ZERO, seasonalBoxes: 0, seasonalLitres: 0, drawerFolded: 0 }; let en = 0, ew = 0, doubleHang = 0, usedHeight = 0, highStorageLitres = 0, maxDailyAccess = 0, liftCount = 0, unassignedLitres = 0, seasonalZoneCount = 0;
    if (!sections.length) errors.push('No storage bays were created.'); if (c.d < 35) errors.push('These fittings need at least 35 cm depth.'); if (sections.length && Math.abs(sections.reduce((s, x) => s + num(x.width, 0), 0) + (sections.length + 1) * PANEL - c.w) > .08) errors.push('Bay widths do not match the cabinet width.');
    sections.forEach((s, i) => {
      let y = BASE; const P = stackY(s); if (s.items.filter(it => it && (it.k === 'short' || it.k === 'lift')).length > 1) doubleHang++; if (!Number.isFinite(s.width) || s.width < 25 - .03) errors.push('Bay ' + (i + 1) + ': width must be at least 25 cm.'); for (const [j, it] of s.items.entries()) { const at = 'Bay ' + (i + 1) + ', item ' + (j + 1); y = BASE + (P[j] ? P[j].y0 : 0); if (!it || !LIMITS[it.k]) { errors.push(at + ': unknown fitting.'); continue } if (!it.purpose) errors.push(at + ': a storage purpose is required.'); if (!Number.isFinite(it.h) || it.h < minH(it, c) - .03 || it.h > LIMITS[it.k][1] + .03) errors.push(at + ': garment clearance or fitting height is invalid.'); if (!feasible(it, iw(it, s.width), c)) errors.push(at + ': fitting does not suit the width, depth, or pull-down setting.'); const a = accessInfo(it, y, c); if (['folded', 'drawer', 'shelf', 'basket'].includes(it.k) && ['pants', 'folded'].includes(it.purpose) && GEO.foldStacks(iw(it, s.width), it.k === 'drawer') < 1) warnings.push('Bay ' + (i + 1) + ' is narrower than one folded stack (' + round((it.k === 'drawer' ? 4 : 3) + DEN.fold) + ' cm at this density), so it adds no folded capacity.'); if (it.k === 'seasonal' && c.seasonalRule && y < c.reach - .03) errors.push(at + ': seasonal storage starts at ' + round(y) + ' cm, below your ' + c.reach + ' cm reach line. It must sit above it.'); if (!a.withinReach) { const problem = at + ': ' + a.label + ' exceeds your ' + (a.limit ? a.limit + ' cm comfortable drawer height' : c.reach + ' cm comfortable reach') + '.'; errors.push(problem); reachIssues.push(problem) } if (occasional(it)) { seasonalZoneCount++; if (it.boxes !== undefined && (!Number.isInteger(it.boxes) || it.boxes < 1 || it.boxes > boxSlots(iw(it, s.width), c))) errors.push(at + ': box count exceeds the shelf space.'); if (y + it.h > c.reach && !(it.k === 'seasonal' && y >= c.reach - .03) && !warnings.some(x => x.startsWith('Occasional storage'))) warnings.push('Occasional storage extends above your reach; it is excluded from daily clothing capacity.') } y += Math.max(0, num(it.h, 0)) }
      const used = P.length ? Math.max(...P.map(q => q.y1)) : 0; usedHeight += used; if (used > H + .08) errors.push('Bay ' + (i + 1) + ': contents exceed the interior height.'); unassignedLitres += Math.max(0, H - used) * num(s.width, 0) * c.d / 1000; const m = capacitiesOf(s, c); en += m.en; ew += m.ew; for (const k in cap) cap[k] += m.capacities[k]; highStorageLitres += m.highStorageLitres; maxDailyAccess = Math.max(maxDailyAccess, m.maxDailyAccess); liftCount += m.liftCount;
    });
    const { coverage, shortfalls, overage } = coverageOf(cap, c), cost = Math.round(frameCost(sections.length, c) + sections.reduce((s, x) => s + sectionCost(x), 0));
    if (c.budget > 0 && cost > c.budget) warnings.push('Estimated cost ' + cost + ' is over your ' + c.budget + ' budget.'); if (cap.seasonalBoxes > c.seasonalTarget) errors.push('Seasonal allocation exceeds your ' + c.seasonalTarget + '-box allowance.'); if (c.upper === 'none' && seasonalZoneCount) errors.push('Seasonal storage is switched off.'); if (c.seasonalTarget && c.seasonalRule && !cap.seasonalBoxes && BASE + H - c.reach < seasonalHeight(c) - .01) warnings.push('Seasonal boxes need ' + seasonalHeight(c) + ' cm above your ' + c.reach + ' cm reach line; this cabinet is too short for them.');
    if (!c.fill && cap.seasonalBoxes < c.seasonalTarget) warnings.push('Seasonal storage: ' + cap.seasonalBoxes + ' of ' + c.seasonalTarget + ' requested box spaces fit alongside daily storage.');
    if (c.needs.long && BASE + c.longDrop + FLOOR_CLEAR > c.reach) warnings.push('Your ' + c.longDrop + ' cm garment drop needs a fixed rail at least ' + round(BASE + c.longDrop + FLOOR_CLEAR) + ' cm high, above your ' + c.reach + ' cm reach. Long hanging cannot be counted as accessible.'); if (liftCount) warnings.push('Pull-down access assumes 65 cm travel and a handle within your reach. Confirm the chosen hardware and its clear swing space.'); if (sections.some(s => s.items.some(it => it?.front))) warnings.push('Shallow hanging uses a front-facing rail with reduced capacity.'); if (c.d > 42 && sections.some(s => s.items.some(it => it && it.k === 'folded'))) warnings.push('Open folded shelves are ' + c.d + ' cm deep, so the back row is hidden. Drawers or pull-outs are easier to use.'); if (KEYS.some(k => c.needs[k]) && ew && en / ew < .75) warnings.push('Some daily items sit outside the ' + (c.accessible ? '38–122' : '60–150') + ' cm prime zone. Frequent items are easier to use nearer to it.');
    return { ergo: ew ? round(en / ew) : 1, doubleHang, valid: !errors.length, errors, warnings: [...new Set(warnings)], reachIssues, capacities: cap, coverage, shortfalls, overage, cost, usedHeight: round(usedHeight), usableHeight: H, utilization: sections.length ? Math.min(1, usedHeight / (sections.length * H)) : 0, highStorageLitres: round(highStorageLitres), unassignedLitres: round(unassignedLitres), maxDailyAccess, liftCount, seasonal: { targetBoxes: c.seasonalTarget, allocatedBoxes: cap.seasonalBoxes, coverage: c.fill || !c.seasonalTarget ? 1 : Math.min(1, cap.seasonalBoxes / c.seasonalTarget), zoneCount: seasonalZoneCount, fill: c.fill } };
  }
  function sectionOptions(w, c) {
    const choices = [], seen = new Set(), make = (k, p) => item(k, p, c, w), S = () => make('short', 'short'), L = () => make('long', 'long'), P = () => make('pants', 'pants'), F = () => make('folded', 'folded'), D = () => c.drawers === 'none' ? null : make('drawer', 'folded'), J = () => make('folded', 'pants'), R = () => make('shoe', 'shoes'), SD = () => make('sdrawer', 'small');
    const templates = [[]], add = (...a) => templates.push(a);
    if (c.needs.short) { add(S()); if (c.needs.folded) { add(D(), S()); add(D(), D(), S()); add(F(), S()); add(D(), S(), F()) } if (c.needs.shoes) { add(R(), S()); add(R(), R(), S()) } if (c.needs.pants) { add(P(), S()); add(J(), S()); add(J(), J(), S()) } add(S(), S()); if (c.allowLift) add(S(), make('lift', 'short')) }
    if (c.needs.long) { add(L()); if (c.needs.shoes) add(R(), L()); if (c.needs.folded) add(D(), L()) }
    for (let folded = 0; folded <= 5; folded++)for (let pants = 0; pants <= 3; pants++) { if (!folded && !pants || folded && !c.needs.folded || pants && !c.needs.pants || folded + pants > 6) continue; add(...Array.from({ length: pants }, J), ...Array.from({ length: folded }, F)); if (folded) add(...Array.from({ length: Math.min(3, folded) }, D), ...Array.from({ length: pants }, J), ...Array.from({ length: Math.max(0, folded - 3) }, F)) }
    if (c.needs.folded) { for (let n = 1; n <= 6; n++)add(...Array.from({ length: n }, D)); for (let n = 2; n <= 5; n++)add(...Array.from({ length: n }, D), F()); if (c.needs.short) add(D(), D(), D(), S()) }
    if (c.needs.pants) { add(P()); add(P(), P()); if (c.needs.folded) { add(P(), F()); add(P(), F(), F()); add(D(), P(), F()) } }
    if (c.needs.shoes) for (let n = 1; n <= 6; n++) { const shoes = Array.from({ length: n }, R); add(...shoes); if (c.needs.folded) { add(...shoes, F()); add(...shoes, F(), F()) } if (c.needs.pants) { add(...shoes, J()); if (c.needs.folded) for (let folded = 1; folded <= 3; folded++)add(...shoes, J(), ...Array.from({ length: folded }, F)) } }
    if (c.needs.small) { const base = templates.slice(); templates.push([SD()], [SD(), SD()]); for (const t of base) { if (t.length && t.length <= 5) { templates.push([SD(), ...t]); if (t.length <= 4) templates.push([SD(), SD(), ...t]); if (t.length >= 2 && t.length <= 4) templates.push([t[0], SD(), ...t.slice(1)]); if (t.length >= 3 && t.length <= 4) templates.push([t[0], t[1], SD(), ...t.slice(2)]) } } }
    function record(items) { const key = items.map(it => [it.k, it.purpose, it.h, it.front ? 1 : 0, it.boxes || 0].join(',')).join(';'); if (seen.has(key)) return; seen.add(key); const section = { width: round(w), items, role: 'Daily clothing' }; const m = capacitiesOf(section, c); choices.push({ section, ...m, cost: sectionCost(section) }) }
    const boxH = seasonalHeight(c), top = BASE + height(c), lift = items => {
      const sum = l => BASE + l.reduce((t, x) => t + x.h, 0), gap = Math.max(0, c.reach - sum(items)), roomAt = (l, i) => { let t = 0, r = Infinity; const cum = l.map(x => t += x.h); for (let j = i; j < l.length; j++)r = Math.min(r, Math.min(height(c), bound(l[j], c)) - cum[j]); return Math.max(0, r) };
      if (gap <= .02) return { out: items.map(x => ({ ...x })), start: Math.max(sum(items), c.reach) };
      if (gap < 20) { const out = items.map(x => ({ ...x })); let left = gap; for (let i = out.length - 1; i >= 0 && left > .005; i--) { const e = Math.min(left, Math.max(0, LIMITS[out[i].k][1] - out[i].h), roomAt(out, i)); out[i].h = round(out[i].h + e); left -= e } if (left <= .02) return { out, start: Math.max(sum(out), c.reach) } }
      if (gap < 15) return null;
      const out = items.map(x => ({ ...x })), n = Math.ceil(gap / 40), each = round(gap / n); let left = gap; for (let i = 0; i < n; i++) { const hh = i === n - 1 ? round(left) : each; out.push({ k: 'shelf', purpose: 'accessories', h: hh }); left -= hh }
      return { out, start: Math.max(sum(out), c.reach) }
    };
    for (const specs of templates) {
      const items = fit(specs, w, c); if (!items) continue; const L = c.seasonalTarget && boxSlots(w, c) > 0 ? lift(items) : null, space = L ? top - L.start : 0, room = space >= boxH - .01;
      if (c.fill && room) { const slots = Math.max(1, Math.min(boxSlots(w, c), c.seasonalTarget)), n = Math.max(1, Math.min(4, Math.floor((space + .01) / boxH), Math.floor(c.seasonalTarget / slots))); record([...L.out, ...Array.from({ length: n }, (_, i) => ({ k: 'seasonal', purpose: 'seasonal', boxes: slots, h: i === n - 1 ? round(Math.min(65, space - boxH * (n - 1))) : boxH }))]); continue }
      record(items); if (room && !c.fill) { const slots = Math.min(boxSlots(w, c), c.seasonalTarget); for (let boxes = 1; boxes <= slots; boxes++)record([...L.out, { k: 'seasonal', purpose: 'seasonal', boxes, h: boxH }]) }
    }
    return choices;
  }
  /* Beam-search helpers. bits: one flag per daily category with capacity (0-5), pull-down rail (6), drawer-folded storage (7).
   Each step scores every (kept layout x section option) pair into typed arrays, so nothing is allocated per pair. Only the pairs
   the beam visits are turned into full states. Order and tie-breaking match a stable full sort by score, highest first. */
  const SCRATCH = { short: 0, long: 0, pants: 0, folded: 0, shoes: 0, small: 0, seasonalBoxes: 0, seasonalLitres: 0, drawerFolded: 0 };
  const optionBits = o => { let b = 0; for (let i = 0; i < KEYS.length; i++)if (o.capacities[KEYS[i]] > 0) b |= 1 << i; if (o.section.items.some(it => it.k === 'lift')) b |= 64; if (o.capacities.drawerFolded > 0) b |= 128; return b };
  // Same arithmetic as utility(), on a 9-slot vector [short,long,pants,folded,shoes,small,seasonalBoxes,seasonalLitres,drawerFolded], with the per-run constants hoisted out.
  const capVec = cap => Float64Array.of(cap.short, cap.long, cap.pants, cap.folded, cap.shoes, cap.small, cap.seasonalBoxes, cap.seasonalLitres, cap.drawerFolded);
  // Priorities. Every plan is measured the same way; a priority only changes the weights (points, coverage is worth 1000) used while searching.
  const PROFILES = [
    { id: 'balanced', label: 'Best overall', ergo: 120, cost: 30 },
    { id: 'value', label: 'Best value', ergo: 120, cost: 350 },
    { id: 'comfort', label: 'Easiest to use', ergo: 420, cost: 30 },
    { id: 'room', label: 'Most room to grow', ergo: 120, cost: 30, room: 300 },
    { id: 'tidy', label: 'Drawer-led', ergo: 120, cost: 30, tidy: 220 },
    { id: 'open', label: 'Open and visible', ergo: 120, cost: 30, open: 220 },
    { id: 'seasonal', label: 'Most seasonal storage', ergo: 120, cost: 30, season: 150 }];
  const activeProfiles = c => PROFILES.filter(p => p.id === 'tidy' ? c.needs.folded > 0 && c.drawers !== 'none' : p.id === 'open' ? c.needs.folded > 0 && c.drawers === 'auto' : p.id === 'seasonal' ? c.seasonalTarget > 0 : true);
  // Cost scale: the budget when there is one, otherwise roughly what a typical full layout of this cabinet costs.
  const costRef = c => c.budget > 0 ? c.budget : Math.max(1, frameCost(clamp(Math.round(c.w / 65), 2, 5), c) * 2.2);
  // The only scoring arithmetic: used for partial beam states and for final ranking. v = [short,long,pants,folded,shoes,small,seasonalBoxes,seasonalLitres,drawerFolded].
  function makeScorer(c, prof = PROFILES[0]) {
    const T = new Float64Array(6), D = new Float64Array(6); let count = 0, items = 0; for (let i = 0; i < 6; i++) { const need = c.target[KEYS[i]]; T[i] = need; D[i] = Math.max(8, need); if (need) { count++; items += need } }
    const st = c.seasonalTarget, fill = c.fill, hasFolded = c.needs.folded > 0, budget = c.budget, ergoW = prof.ergo, costW = prof.cost / costRef(c), roomW = prof.room || 0, seasonW = prof.season || 0, seasonDen = fill ? 8 : Math.max(1, st);
    // drawer preference: [weight, share of folded clothing that earns all of it, +1 prefer drawers / -1 prefer open shelves]
    const dw = prof.id === 'tidy' ? [prof.tidy, .85, 1] : prof.id === 'open' ? [prof.open, .3, -1] : c.drawers === 'more' ? [90, .75, 1] : c.drawers === 'auto' ? [35, .4, 1] : [0, 1, 1];
    return (v, e, cost = 0, strict = false) => {
      let sum = 0, covered = 0, overage = 0, spare = 0, missing = 0; for (let i = 0; i < 6; i++) { const need = T[i], x = v[i]; if (need) { sum += Math.min(1, x / need); covered += Math.min(need, x); spare += Math.min(1, Math.max(0, x - need) / (.6 * need)); if (x < 1) missing++ } overage += Math.max(0, x - need) / D[i] }
      const total = count ? .5 * sum / count + .5 * covered / items : 1, season = st ? Math.min(1, v[6] / st) : 1, share = hasFolded && v[3] > 0 ? (v[8] || 0) / v[3] : 0, pref = Math.min(1, share / dw[1]);
      let s = total * 1000 + (fill ? Math.min(v[6], st) : season * 12) + e * ergoW - overage * 4 - costW * cost + dw[0] * (dw[2] > 0 ? pref : 1 - pref);
      if (roomW) s += roomW * (count ? spare / count : 0);
      if (seasonW) s += seasonW * Math.min(1, v[6] / seasonDen);
      if (budget > 0 && cost > budget) s -= 700 * (cost / budget - 1);
      return strict ? s - missing * MISSING_PENALTY : s
    }
  }
  const SC9 = new Float64Array(9);
  let BUF_S = new Float64Array(0), BUF_P = new Int32Array(0), BUF_O = new Int32Array(0);
  const BEAM_WIDTH = 48, BEAM_ALT = 14, TOP_K = 400;
  function selectBeam(beam, opts, c, scorer, width = BEAM_WIDTH) {
    const cap = beam.length * opts.length; if (BUF_S.length < cap) { BUF_S = new Float64Array(cap); BUF_P = new Int32Array(cap); BUF_O = new Int32Array(cap) }
    const repIdx = new Int32Array(256).fill(-1); let N = 0;
    const sc9 = SC9, seasonalTarget = c.seasonalTarget;
    for (let pi = 0; pi < beam.length; pi++) {
      const state = beam[pi], pcv = state.cv || (state.cv = capVec(state.cap)), sb = pcv[6]; for (let oi = 0; oi < opts.length; oi++) {
        const o = opts[oi], ocv = o.cv || (o.cv = capVec(o.capacities)); if (sb + ocv[6] > seasonalTarget) continue;
        for (let j = 0; j < 9; j++)sc9[j] = pcv[j] + ocv[j];
        const en = state.en + o.en, ew = state.ew + o.ew, sc = scorer(sc9, ew ? en / ew : 1, state.cost + o.cost), b = state.bits | o.bits; BUF_S[N] = sc; BUF_P[N] = pi; BUF_O[N] = oi; const r = repIdx[b]; if (r < 0 || sc > BUF_S[r]) repIdx[b] = N; N++
      }
    }
    if (!N) return [];
    const cmp = (x, y) => BUF_S[y] - BUF_S[x] || x - y;
    const reps = []; for (let b = 0; b < 256; b++)if (repIdx[b] >= 0) reps.push(repIdx[b]); reps.sort(cmp);
    // Progress signature of a pair, computed from the capacity vectors so a full state is only built for the pairs that are kept.
    // Equivalent to bucketing each category (none / under 75% / under 100% / met), plus seasonal boxes, pull-down rail and drawer storage.
    const need = new Float64Array(6), need75 = new Float64Array(6); for (let i = 0; i < 6; i++) { need[i] = c.needs[KEYS[i]]; need75[i] = need[i] * .75 }
    const sigOf = i => {
      const p = beam[BUF_P[i]], o = opts[BUF_O[i]], pv = p.cv, ov = o.cv; let key = 0; for (let j = 0; j < 6; j++) { const n = need[j]; let d = 0; if (n) { const x = pv[j] + ov[j]; d = x === 0 ? 0 : x >= n ? 3 : x >= need75[j] ? 2 : 1 } key = key * 4 + d }
      return key + 4096 * ((pv[6] + ov[6]) + 256 * (((p.bits | o.bits) & 64 ? 1 : 0) + ((pv[8] + ov[8]) > 0 ? 2 : 0)))
    };
    const build = i => { const p = beam[BUF_P[i]], o = opts[BUF_O[i]], cp = {}; for (const k in p.cap) cp[k] = p.cap[k] + o.capacities[k]; return { sections: [...p.sections, o.section], cap: cp, cost: p.cost + o.cost, en: p.en + o.en, ew: p.ew + o.ew, score: BUF_S[i], bits: p.bits | o.bits } };
    const take = list => { const out = [], unique = new Set(), visit = i => { const sig = sigOf(i); if (unique.has(sig)) return false; unique.add(sig); out.push(build(i)); return out.length >= width }; for (const i of reps) if (visit(i)) return out; for (const i of list) if (visit(i)) return out; return out };
    // Only the best pairs are ordered, widening the cut (400, 2000, then all) if they cannot fill the beam. Visiting order matches a full stable sort.
    let sorted = null;
    for (const K of [TOP_K, TOP_K * 5]) { if (N <= K) break; if (!sorted) sorted = BUF_S.slice(0, N).sort(); const T = sorted[N - K], list = []; for (let i = 0; i < N; i++)if (BUF_S[i] >= T) list.push(i); list.sort(cmp); const out = take(list); if (out.length >= width || list.length === N) return out }
    const all = new Array(N); for (let i = 0; i < N; i++)all[i] = i; all.sort(cmp); return take(all);
  }
  function widthSets(c, n) { const usable = c.w - (n + 1) * PANEL, weights = [Array(n).fill(1), Array.from({ length: n }, (_, i) => [1.2, .8, 1][i % 3]), Array.from({ length: n }, (_, i) => i === 0 ? 1.45 : .85)]; const seen = new Set(); return weights.map(a => { const total = a.reduce((s, x) => s + x, 0), ws = a.map(x => round(usable * x / total)); ws[n - 1] = round(ws[n - 1] + usable - ws.reduce((s, x) => s + x, 0)); return ws }).filter(ws => { const sig = ws.join(','); if (seen.has(sig) || ws.some(w => w < 25 || w > 125)) return false; seen.add(sig); return true }) }
  const MISSING_PENALTY = 70;
  const SCORERS = new WeakMap();
  function utility(cap, c, cost, e = 1, strict = false) { let f = SCORERS.get(c); if (!f || f.t !== c.seasonalTarget) { f = { t: c.seasonalTarget, s: makeScorer(c) }; SCORERS.set(c, f) } return f.s(capVec(cap), e, cost, strict) }
  function signature(sections, coarse = false) { return sections.map(s => (coarse ? Math.round(s.width / 10) : s.width) + ':' + s.items.map(it => [it.k, it.purpose, coarse ? '' : it.h, it.front ? 1 : 0, coarse ? '' : it.boxes || 0].join(',')).join(';')).sort().join('|') }
  function details(sections, c) { const kinds = sections.flatMap(s => s.items.map(it => it.k)), has = k => kinds.includes(k); let title = 'Balanced daily storage'; if (!kinds.length) title = 'Space for future storage'; else if (!KEYS.some(k => c.needs[k])) title = 'Your seasonal allowance'; else if (has('lift')) title = 'Double hanging with pull-down access'; else if (has('long') && has('short') && has('pants')) title = 'Long and short hanging with trouser pull-outs'; else if (has('pants')) title = 'Hanging and trouser pull-outs'; else if (has('long') && has('short')) title = 'Long and short hanging'; else if (has('drawer') || has('sdrawer')) title = 'Drawers and folded essentials'; else if (has('short')) title = 'Hanging with useful lower storage'; else if (has('shoe')) title = 'Shoes and folded clothing'; else title = 'Visible folded storage'; return title }
  // ---- Choosing what to show ----
  // Quality floor shared by every priority: no more empty categories than the best plan, and coverage within GATE of it.
  // Alternatives must differ from every plan already shown by at least DMIN (see planDistance), so near-duplicates never fill the list;
  // a priority's own pick may be a little closer (DMIN_LENS) because it must also beat the others on its own measure to earn its label.
  const GATE = .06, DMIN = .1, DMIN_LENS = .05, MAX_PLANS = 8, KEEP_ALT = 14;
  function featuresOf(p, c, scorers) {
    const cap = p.metrics.capacities, vec = capVec(cap), kinds = {};
    for (const s of p.sections) for (const it of s.items) { if (it.k === 'shelf' && it.purpose === 'accessories') continue; const key = it.k + ':' + it.purpose; kinds[key] = (kinds[key] || 0) + 1 }
    let missing = 0, spare = 0, n = 0; for (const k of KEYS) { const need = c.target[k]; if (need) { n++; spare += Math.min(1, Math.max(0, cap[k] - need) / (.6 * need)); if (cap[k] < 1) missing++ } }
    const u = {}; for (const id in scorers) u[id] = scorers[id](vec, p.metrics.ergo, p.cost, true);
    return { p, cap, kinds, missing, u, room: n ? spare / n : 0, share: c.needs.folded > 0 && cap.folded > 0 ? (cap.drawerFolded || 0) / cap.folded : 0, cov: p.metrics.coverage.total, ergo: p.metrics.ergo, cost: p.cost, bays: p.sections.length, boxes: cap.seasonalBoxes }
  }
  // 0 = the same plan for practical purposes, 1 = nothing in common. Mixes how coverage is shared out, which fittings are used, bay count, drawer share, cost and comfort.
  function planDistance(a, b, c) {
    let dc = 0, n = 0; for (const k of KEYS) { const need = c.target[k]; if (need) { dc += Math.min(1, Math.abs(a.cap[k] - b.cap[k]) / need); n++ } }
    let l1 = 0, tot = 0; for (const k in { ...a.kinds, ...b.kinds }) { const x = a.kinds[k] || 0, y = b.kinds[k] || 0; l1 += Math.abs(x - y); tot += Math.max(x, y) }
    return .3 * (n ? dc / n : 0) + .25 * (tot ? l1 / tot : 0) + .1 * Math.abs(a.bays - b.bays) / Math.max(a.bays, b.bays) + .15 * Math.abs(a.share - b.share) + .1 * Math.abs(a.cost - b.cost) / Math.max(a.cost, b.cost, 1) + .1 * Math.min(1, Math.abs(a.ergo - b.ergo) * 3)
  }
  // A plan earns a label only by clearly beating every other plan shown on that one measure.
  const lo = (o, f) => Math.min(...o.map(f)), hi = (o, f) => Math.max(...o.map(f)), pct = x => Math.round(x * 100);
  function badgeDefs(c) {
    return {
      value: { label: 'Best value', win: (f, o) => f.cost <= lo(o, x => x.cost) * .97, text: (f, z) => 'Lowest estimated cost of the options shown (' + f.cost + (f === z ? '' : ', against ' + z.cost + ' for the best overall plan') + ').' },
      comfort: { label: 'Easiest to use', win: (f, o) => f.ergo >= hi(o, x => x.ergo) + .02, text: (f, z) => 'Highest everyday comfort score (' + pct(f.ergo) + ' / 100' + (f === z ? '' : ', against ' + pct(z.ergo) + ' for the best overall plan') + ').' },
      room: { label: 'Most room to grow', win: (f, o) => f.room >= hi(o, x => x.room) + .05, text: (f, z) => 'Most spare capacity beyond your targets (about ' + Math.round(f.room * 60) + '% on average' + (f === z ? '' : ', against ' + Math.round(z.room * 60) + '% for the best overall plan') + ').' },
      tidy: { label: 'Drawer-led', win: (f, o) => f.share > 0 && f.share >= hi(o, x => x.share) + .1, text: f => 'Keeps ' + pct(f.share) + '% of folded clothing in drawers.' },
      open: { label: 'Open and visible', win: (f, o) => c.needs.folded > 0 && f.share <= lo(o, x => x.share) - .1, text: f => 'Most folded clothing sits on open shelves (' + pct(1 - f.share) + '% is not in drawers).' },
      seasonal: { label: 'Most seasonal storage', win: (f, o) => f.boxes >= hi(o, x => x.boxes) + 1, text: f => 'Holds ' + f.boxes + ' seasonal boxes.' }
    }
  }
  // For each priority the pick is the plan that is best on that priority's own measure among plans that clear the quality floor (ties go to the better overall plan).
  const LENS = { value: { m: f => -f.cost, eps: b => Math.abs(b) * .01 }, comfort: { m: f => f.ergo, eps: () => .01 }, room: { m: f => f.room, eps: () => .02 }, tidy: { m: f => f.share, eps: () => .05 }, open: { m: f => -f.share, eps: () => .05 }, seasonal: { m: f => f.boxes, eps: () => 0 } };
  function select(pool, c, profiles) {
    const scorers = {}; for (const pr of profiles) scorers[pr.id] = makeScorer(c, pr);
    const fs = pool.map(p => featuresOf(p, c, scorers)); if (!fs.length) return [];
    const within = c.budget > 0 ? fs.filter(f => f.cost <= c.budget * 1.05) : [], ref = within.length ? within : fs, bestMissing = Math.min(...ref.map(f => f.missing)), bestCov = Math.max(...ref.filter(f => f.missing <= bestMissing).map(f => f.cov));
    const ok = fs.filter(f => f.missing <= bestMissing && f.cov >= bestCov - GATE), defs = badgeDefs(c), chosen = [], gap = f => chosen.length ? Math.min(...chosen.map(g => planDistance(f, g, c))) : 1, better = (a, b) => b.u.balanced > a.u.balanced ? b : a;
    const top = ok.reduce(better); top.profile = 'balanced'; chosen.push(top);
    for (const pr of profiles) {
      if (pr.id === 'balanced') continue; const L = LENS[pr.id], cand = ok.filter(f => !chosen.includes(f) && gap(f) >= DMIN_LENS); if (!cand.length) continue;
      const best = Math.max(...cand.map(L.m)), pick = cand.filter(f => L.m(f) >= best - L.eps(best)).reduce(better); if (defs[pr.id].win(pick, chosen)) { pick.profile = pr.id; chosen.push(pick) }
    }
    while (chosen.length < MAX_PLANS) { let best = null, bs = -Infinity; for (const f of ok) { if (chosen.includes(f)) continue; const d = gap(f); if (d < DMIN) continue; const s = f.u.balanced - 300 * Math.max(0, 1 - d / .25); if (s > bs) { bs = s; best = f } } if (!best) break; best.profile = 'alt'; chosen.push(best) }
    return chosen
  }
  function present(chosen, c) {
    const first = chosen[0], out = [], defs = badgeDefs(c), r1 = x => Math.round(x * 10) / 10;
    chosen.forEach((f, idx) => {
      const p = f.p, others = chosen.filter(x => x !== f), won = others.length ? Object.values(defs).filter(b => b.win(f, others)) : [];
      p.sections = p.sections.map(s => ({ ...s, items: s.items.map(it => ({ ...it })), role: [...new Set(s.items.map(it => occasional(it) ? 'seasonal boxes' : NAMES[it.purpose] || it.purpose))].join(' + ') || 'Available space' }));
      p.label = idx === 0 ? 'Best overall' : won.length ? won[0].label : 'Alternative layout'; p.badges = won.map(b => b.label); p.score = round(f.u.balanced); p.profile = f.profile; p.id = 'layout-' + (idx + 1);
      let title = p.label + ' · ' + details(p.sections, c); if (out.some(x => x.title === title)) { const drawers = p.sections.flatMap(s => s.items).filter(it => it.k === 'drawer' || it.k === 'sdrawer').length; title += ' · ' + (drawers ? drawers + (drawers === 1 ? ' drawer' : ' drawers') : p.sections.length + ' bays'); if (out.some(x => x.title === title)) title += ' · option ' + (idx + 1) }
      p.title = title; p.summary = p.metrics.liftCount ? 'Daily storage stays within reach using the shown pull-down handles.' : '';
      const reasons = won.map(b => b.text(f, first));
      if (idx > 0) { const dc = (f.cov - first.cov) * 100, dk = (f.cost / first.cost - 1) * 100; if (Math.abs(dc) >= .5 || Math.abs(dk) >= 2) reasons.push('Compared with the best overall plan: ' + (Math.abs(dc) < .5 ? 'about the same coverage' : r1(Math.abs(dc)) + ' points ' + (dc < 0 ? 'less' : 'more') + ' of your needs covered') + ', ' + (Math.abs(dk) < 2 ? 'about the same cost.' : Math.round(Math.abs(dk)) + '% ' + (dk < 0 ? 'cheaper.' : 'dearer.'))) }
      reasons.push('Highest daily access: ' + p.metrics.maxDailyAccess + ' cm / ' + c.reach + ' cm.', c.fill ? 'Spare space above your reach holds ' + p.metrics.seasonal.allocatedBoxes + ' seasonal boxes.' : 'Seasonal allowance: ' + p.metrics.seasonal.allocatedBoxes + ' / ' + c.seasonalTarget + ' boxes.');
      if (p.metrics.unassignedLitres > 1) reasons.push('Unneeded upper space stays available; it adds no clothing capacity.'); if (p.metrics.liftCount) reasons.push('Pull-down handles and lowered rails fit your reach; fixed upper rails are not substituted.');
      p.reasons = reasons; p.warnings = p.metrics.warnings.slice(); out.push(p)
    });
    return out
  }
  function generate(raw) {
    const c = normalize(raw), H = height(c), fixed = Array.isArray(raw && raw.bayWidths) ? raw.bayWidths.slice() : null;
    if (fixed && (fixed.length < 1 || fixed.length > 6 || fixed.some(w => !Number.isFinite(w) || w < 25 - .03) || Math.abs(fixed.reduce((a, b) => a + b, 0) + (fixed.length + 1) * PANEL - c.w) > .08)) return []; if (c.w < 28.6 || H < 100 || c.d < 35) return [];
    const pool = [], seen = new Set(), cache = new Map(), maxN = Math.min(6, Math.floor((c.w - PANEL) / (25 + PANEL))), profiles = activeProfiles(c);
    const optionsFor = w => { if (!cache.has(w)) { const opts = sectionOptions(w, c); for (const o of opts) o.bits = optionBits(o); cache.set(w, opts) } return cache.get(w) };
    // One beam search per priority, sharing the per-width option cache, so cheap, comfortable, drawer-heavy... plans survive the search instead of being pruned for scoring lower on the balanced measure.
    // The balanced search runs first and shows which bay counts can reach the quality floor at all; the other priorities skip the rest.
    const byN = {}; let bestAll = 0;
    for (const pr of profiles) {
      const alt = pr.id !== 'balanced', scorer = makeScorer(c, pr), width = alt ? BEAM_ALT : BEAM_WIDTH, keep = alt ? KEEP_ALT : BEAM_WIDTH;
      for (let n = fixed ? fixed.length : 1; n <= (fixed ? fixed.length : maxN); n++)for (const ws of (fixed ? [fixed] : widthSets(c, n))) {
        if (alt && !fixed && !(byN[n] >= bestAll - GATE - .04)) continue; const panel = frameCost(n, c); let beam = [{ sections: [], cap: { short: 0, long: 0, pants: 0, folded: 0, shoes: 0, small: 0, seasonalBoxes: 0, seasonalLitres: 0, drawerFolded: 0 }, cost: panel, en: 0, ew: 0, score: 0, bits: 0 }];
        for (const w of ws) { beam = selectBeam(beam, optionsFor(w), c, scorer, width); if (!beam.length) break }
        for (const state of beam.filter(s => s.sections.length === n).sort((a, b) => b.score - a.score).slice(0, keep)) { const sig = signature(state.sections); if (seen.has(sig)) continue; seen.add(sig); const metrics = analyze(state.sections, c); if (!metrics.valid) continue; if (!alt) { byN[n] = Math.max(byN[n] || 0, metrics.coverage.total); bestAll = Math.max(bestAll, metrics.coverage.total) } pool.push({ sections: state.sections, metrics, cost: metrics.cost, coverage: metrics.coverage }) }
      }
    }
    return present(select(pool, c, profiles), c)
  }
  // existing (optional): capacities already provided by the other bays, e.g. analyze(...).capacities. Without it each bay is fitted as if it were the only one.
  function fitSection(width, raw, index = 0) {
    const c = normalize(raw), full = { ...c }, ex = raw && raw.existing && typeof raw.existing === 'object' ? raw.existing : null;
    if (raw && Number.isFinite(raw.seasonalRemaining)) c.seasonalTarget = clamp(raw.seasonalRemaining, 0, c.seasonalTarget); else if (ex) c.seasonalTarget = clamp(c.seasonalTarget - num(ex.seasonalBoxes, 0), 0, c.seasonalTarget);
    const choices = sectionOptions(width, c), ev = x => x.ew ? x.en / x.ew : 1, sum = x => { if (!ex) return x.capacities; const m = { ...x.capacities }; for (const k in m) m[k] += num(ex[k], 0); return m }, sc = makeScorer(ex ? full : c), val = x => sc(capVec(sum(x)), ev(x), x.cost, false);
    choices.sort((a, b) => val(b) - val(a)); const best = choices[0]; return best ? { ...best.section, items: best.section.items.map(it => ({ ...it })) } : null
  }
  return { generate, analyze, fitSection, layoutSection, placeItem, accessInfo, geo: GEO, configure: raw => { normalize(raw) }, zoneOf, longMin, itemWidth: iw, seasonalAllowance: raw => normalize(raw).seasonalTarget };
})();