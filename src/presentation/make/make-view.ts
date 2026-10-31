import type { EditorScene } from '../../application/projects/editor-scene';
import { getDecor } from '../../domain/materials/decor-catalog';
import { makePiece, type MakePiece } from '../../domain/make/make-parts';
import { LENGTH_UNITS } from '../../domain/geometry/length-units';
import { pieceName } from '../../domain/drawings/room-pieces';
import { currentLengthUnit, lengthText, onLengthUnitChange, setLengthUnit } from '../editor/length-unit-state';
import { createModelPane } from './make-model-pane';
import { partSheetSvg, partTileSvg } from './make-sheet';
import { MAKE_ICONS as I } from './make-icons';
import type { MakeViewPorts } from './make-view.ports';

const BAND_KEY = 'furnidraw.make.band';
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** A decor's colour lightened (k > 0) or darkened (k < 0), for the three shaded faces of the Material look. */
function tone(hex: string, k: number) {
  const n = parseInt(hex.replace('#', ''), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function decorOf(id: string) { try { return getDecor(id); } catch { return null; } }

const MARKUP = `<header class="mk-bar">
  <button type="button" class="mk-pill mk-backbtn" data-close aria-label="Back to Furniture">${I.back}<span class="mk-name" translate="no"></span></button>
  <div class="mk-pill mk-tabs" role="tablist" aria-label="Views">
    <button type="button" role="tab" data-tab="model" aria-selected="true">${I.model}<span>Model</span></button>
    <button type="button" role="tab" data-tab="drawings" aria-selected="false">${I.drawings}<span>Drawings</span></button>
  </div>
  <div class="mk-pill mk-right"><button type="button" class="mk-unit" aria-label="Units" title="Units"></button></div>
</header>
<section class="mk-pane mk-model" data-pane="model">
  <div class="mk-stagebox"><svg class="mk-stage" role="img" aria-label="The piece with its measurements. Drag to turn it; tap a part to see its own."></svg>
    <div class="mk-pill mk-views" role="group" aria-label="View">
      <button type="button" data-view="iso" aria-label="3D view" title="3D">${I.view3d}</button>
      <button type="button" data-view="front" aria-label="Front view" title="Front">${I.front}</button>
      <button type="button" data-view="side" aria-label="Side view" title="Side">${I.side}</button>
      <button type="button" data-view="top" aria-label="Top view" title="Top">${I.top}</button>
    </div></div>
  <aside class="mk-dock" aria-label="Selected part" hidden></aside>
  <div class="mk-film" aria-label="Parts"></div>
  <div class="mk-tools"><div class="mk-pill" role="group" aria-label="Model tools">
    <label class="mk-apart" title="Take apart">${I.assembled}<input type="range" min="0" max="100" value="0" data-apart aria-label="Take apart">${I.apart}</label>
    <span class="mk-sep"></span>
    <button type="button" data-toggle="solidFronts" aria-pressed="false" aria-label="Solid doors and fronts" title="Doors and fronts">${I.fronts}</button>
    <button type="button" data-toggle="measures" aria-pressed="true" aria-label="Measurements" title="Measurements">${I.measures}</button>
    <button type="button" data-toggle="numbers" aria-pressed="false" aria-label="Part numbers" title="Part numbers">${I.numbers}</button>
    <span class="mk-sep"></span>
    <button type="button" data-choose-look="lines" aria-pressed="true" aria-label="Lines" title="Lines">${I.lines}</button>
    <button type="button" data-choose-look="material" aria-pressed="false" aria-label="Material" title="Material">${I.material}</button>
    <button type="button" data-choose-look="xray" aria-pressed="false" aria-label="X-ray" title="X-ray">${I.xray}</button>
  </div></div>
</section>
<section class="mk-pane mk-drawings" data-pane="drawings" hidden>
  <nav class="mk-rail" aria-label="Part sheets"></nav>
  <div class="mk-viewer"><div class="mk-viewer-bar"><button type="button" class="mk-link" data-set>${I.sheet}<span>Full drawing set</span></button></div><div class="mk-sheet"></div></div>
</section>`;

/**
 * Make: the selected wardrobe or cabinet taken down to its parts, opened from the piece's toolbar in Furniture. Model
 * shows it with every measurement; Drawings shows each part flat, to cut from. It reads the design and never changes it.
 */
export function createMakeView({ dom, lifetime, scene, openDrawings, toast }: MakeViewPorts) {
  const panel = dom.document.createElement('div');
  panel.className = 'mk';
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Make');
  panel.dataset.look = 'lines';
  panel.innerHTML = MARKUP;
  dom.$('#app').append(panel);
  const q = <E extends Element>(selector: string) => panel.querySelector<E>(selector)!;
  const listen = lifetime.listen as (target: EventTarget, event: string, handler: (e: Event) => void, options?: AddEventListenerOptions) => void;
  let piece: MakePiece | null = null, tab: 'model' | 'drawings' = 'model', sheet = 1;
  let band = (() => { try { return Number(globalThis.localStorage?.getItem(BAND_KEY)) || 0; } catch { return 0; } })();
  const length = () => (cm: number) => lengthText(cm);
  const material = (id: string) => decorOf(id)?.name ?? '';
  const shades = () => new Map((piece?.parts ?? []).flatMap(p => {
    const hex = decorOf(p.decorId)?.pbr.baseHex;
    return hex ? [[p.n, { ft: tone(hex, .18), ff: hex, fs: tone(hex, -.16) }] as const] : [];
  }));

  const model = createModelPane({ stage: q<SVGSVGElement>('.mk-stage'), dock: q('.mk-dock'), film: q('.mk-film'), tools: q('.mk-tools'), views: q('.mk-views'),
    listen, frame: callback => lifetime.frame(callback), reducedMotion: () => dom.matchMedia('(prefers-reduced-motion: reduce)').matches,
    length, material, shades, band: { get: () => band, set: mm => { band = mm; try { globalThis.localStorage?.setItem(BAND_KEY, String(mm)); } catch { /* private window */ } } },
    openSheet: n => { sheet = n; show('drawings'); }, close });

  function renderDrawings() {
    if (!piece) return;
    q('.mk-rail').innerHTML = piece.parts.map(p => `<button type="button" data-sheet="${p.n}" aria-pressed="${p.n === sheet}">${partTileSvg(p, 30)}`
      + `<span><span class="mk-num">${p.n}</span><span class="mk-rn" translate="no">${esc(p.name)}</span></span></button>`).join('');
    const part = piece.parts.find(p => p.n === sheet) ?? piece.parts[0]!;
    q('.mk-sheet').innerHTML = partSheetSvg(part, length(), material(part.decorId), band);
  }
  function show(next: 'model' | 'drawings') {
    tab = next;
    panel.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === next)));
    panel.querySelectorAll<HTMLElement>('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== next; });
    if (next === 'drawings') renderDrawings(); else model.render();
  }
  function renderUnit() { q('.mk-unit').textContent = currentLengthUnit(); }
  function open() {
    const s: EditorScene = scene(), cabinet = s.wardrobes.find(w => w.id === s.activeWardrobe);
    const input = { studio: s.studio, pieces: s.wardrobes.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, design: c.state })) };
    piece = cabinet ? makePiece(input, cabinet.id) : null;
    if (!piece || !cabinet) { toast('Select a wardrobe or cabinet to make'); return; }
    q('.mk-name').textContent = pieceName({ design: cabinet.state, name: cabinet.name });
    sheet = piece.parts[0]!.n;
    panel.hidden = false;
    renderUnit();
    model.show(piece);
    show('model');
    panel.focus({ preventScroll: true });
  }
  function close() { panel.hidden = true; piece = null; }

  listen(panel, 'click', e => {
    const t = e.target as Element, tabButton = t.closest<HTMLElement>('[data-tab]'), look = t.closest<HTMLElement>('[data-choose-look]'), part = t.closest<HTMLElement>('.mk-rail [data-sheet]');
    if (t.closest('[data-close]')) close();
    else if (tabButton) show(tabButton.dataset.tab as 'model' | 'drawings');
    else if (look) {
      panel.dataset.look = look.dataset.chooseLook!;
      panel.querySelectorAll<HTMLElement>('[data-choose-look]').forEach(b => b.setAttribute('aria-pressed', String(b === look)));
    } else if (part) { sheet = Number(part.dataset.sheet); renderDrawings(); }
    else if (t.closest('[data-set]')) openDrawings();
    else if (t.closest('.mk-unit')) {
      const at = LENGTH_UNITS.findIndex(u => u.key === currentLengthUnit());
      setLengthUnit(LENGTH_UNITS[(at + 1) % LENGTH_UNITS.length]!.key);
    }
  });
  // Keys stay inside Make, so editor shortcuts (delete, undo) never act on the design behind it.
  listen(panel, 'keydown', e => {
    const k = e as KeyboardEvent;
    k.stopPropagation();
    if (k.key === 'Escape') { if (tab === 'model' && model.selected !== null) model.select(null); else close(); }
    else if (tab === 'model' && model.selected !== null && (k.key === 'ArrowRight' || k.key === 'ArrowLeft')) { model.step(k.key === 'ArrowRight' ? 1 : -1); k.preventDefault(); }
  });
  lifetime.cleanup(onLengthUnitChange(() => { if (panel.hidden) return; renderUnit(); if (tab === 'drawings') renderDrawings(); else model.render(); }));
  lifetime.cleanup(() => panel.remove());
  return { open, close, get isOpen() { return !panel.hidden; } };
}
