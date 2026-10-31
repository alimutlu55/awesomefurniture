import { cutWithBand, type MakePiece } from '../../domain/make/make-parts';
import { MAKE_VIEWS, type MakeView, type MakeViewName } from './make-projection';
import { type LengthText, modelFrame, modelSvg, type PartShades } from './make-scene';
import { partSheetSvg, partTileSvg } from './make-sheet';
import { MAKE_ICONS } from './make-icons';

/** What the Model pane needs from the view around it. */
export interface ModelPanePorts {
  /** The pane's elements, built by the view. */
  readonly stage: SVGSVGElement;
  readonly dock: HTMLElement;
  readonly film: HTMLElement;
  readonly tools: HTMLElement;
  readonly views: HTMLElement;
  readonly listen: (target: EventTarget, event: string, handler: (e: Event) => void, options?: AddEventListenerOptions) => void;
  readonly frame: (callback: (time: number) => void) => number;
  readonly reducedMotion: () => boolean;
  readonly length: () => LengthText;
  readonly material: (decorId: string) => string;
  readonly shades: () => PartShades;
  /** The edge banding taken off cut sizes, millimetres, shared with the Drawings pane. */
  readonly band: { get(): number; set(mm: number): void };
  /** Shows a part full size in the Drawings pane. */
  readonly openSheet: (n: number) => void;
  /** Back to Furniture, with the piece still selected. */
  readonly close: () => void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const BANDS = [0, .4, 1, 2] as const;

/**
 * The model of one piece: every board drawn from the cutting list, every measurement on show and ranked so labels never
 * fight; drag to turn it, pinch or scroll to zoom, the view buttons to square it. Tapping a part fades the rest, switches
 * the measurements to that part and docks its flat drawing beside the model.
 */
export function createModelPane(ports: ModelPanePorts) {
  const { stage, dock, film, tools, views, listen } = ports;
  let piece: MakePiece | null = null;
  const st = { view: { ...MAKE_VIEWS.iso } as MakeView, named: 'iso' as MakeViewName | '', apart: 0, solidFronts: false, measures: true, numbers: false,
    selected: null as number | null, zoom: 1, focus: { x: .5, y: .5 } };

  function render() {
    if (!piece) return;
    // Labels stay 13 px on screen whatever the zoom or the screen: the drawing is scaled to fit, the text is not.
    const frame = modelFrame(piece, st), box = stage.getBoundingClientRect();
    const unitsPerPx = Math.max((frame.x1 - frame.x0) / Math.max(box.width, 1), (frame.y1 - frame.y0) / Math.max(box.height, 1)) / st.zoom;
    const out = modelSvg(piece, st, ports.length(), ports.shades(), box.width ? 13 * unitsPerPx : undefined);
    const [x, y, w, h] = out.viewBox.split(' ').map(Number) as [number, number, number, number];
    const zw = w / st.zoom, zh = h / st.zoom;
    stage.setAttribute('viewBox', [x + (w - zw) * st.focus.x, y + (h - zh) * st.focus.y, zw, zh].map(v => v.toFixed(2)).join(' '));
    stage.innerHTML = out.markup;
    stage.classList.toggle('has-sel', out.selected);
    views.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === st.named)));
  }
  function renderFilm() {
    if (!piece) return;
    film.innerHTML = piece.parts.map(p => `<button type="button" class="mk-tile" data-n="${p.n}" aria-pressed="${st.selected === p.n}"`
      + ` aria-label="${p.n} ${esc(p.name)} ${ports.length()(p.cut.length)} × ${ports.length()(p.cut.width)}">`
      + (p.boards.length > 1 ? `<span class="mk-qty">×${p.boards.length}</span>` : '') + partTileSvg(p)
      + `<span class="mk-tn"><span class="mk-num">${p.n}</span>${ports.length()(p.cut.length)}×${ports.length()(p.cut.width)}</span></button>`).join('');
  }
  function renderDock() {
    const part = piece?.parts.find(p => p.n === st.selected);
    dock.hidden = !part;
    dock.parentElement!.classList.toggle('focused', !!part);
    if (!part) return;
    const length = ports.length(), band = ports.band.get(), cut = cutWithBand(part, band), material = ports.material(part.decorId);
    dock.innerHTML = `<div class="mk-dh"><button type="button" class="mk-ibtn" data-step="-1" aria-label="Previous part">${MAKE_ICONS.back}</button>`
      + `<span class="mk-num lg">${part.n}</span><b>${esc(part.name)}</b>${part.boards.length > 1 ? `<span class="mk-q">×${part.boards.length}</span>` : ''}`
      + `<span class="mk-sp"></span><button type="button" class="mk-ibtn" data-step="1" aria-label="Next part">${MAKE_ICONS.next}</button>`
      + `<button type="button" class="mk-ibtn" data-clear aria-label="All measurements">${MAKE_ICONS.close}</button></div>`
      + `<div class="mk-big" translate="no">${length(part.cut.length)} × ${length(part.cut.width)} × ${length(part.cut.thickness)}`
      + `<small>${band && part.edges !== '—' ? `${MAKE_ICONS.cut} ${length(cut.length)} × ${length(cut.width)} · ` : ''}${esc(material)}</small></div>`
      + `<button type="button" class="mk-sheetbtn" data-sheet aria-label="Full size drawing">${partSheetSvg(part, length, material, band, true)}</button>`
      + (part.edges !== '—' ? `<div class="mk-seg" role="group" aria-label="Edge banding taken off the cut size">${MAKE_ICONS.cut}`
        + BANDS.map(v => `<button type="button" data-band="${v}" aria-pressed="${band === v}">${v} mm</button>`).join('') + '</div>' : '')
      + `<div class="mk-links"><button type="button" class="mk-link" data-sheet>${MAKE_ICONS.expand}<span>Full size</span></button>`
      + `<button type="button" class="mk-link" data-furniture>${MAKE_ICONS.edit}<span>Change in Furniture</span></button></div>`;
  }
  function select(n: number | null) {
    st.selected = n;
    renderFilm(); renderDock(); render();
    const tile = film.querySelector<HTMLElement>(`[data-n="${n}"]`);
    if (tile) {
      const left = tile.offsetLeft - film.offsetLeft, right = left + tile.offsetWidth;
      if (left < film.scrollLeft) film.scrollLeft = left - 12;
      else if (right > film.scrollLeft + film.clientWidth) film.scrollLeft = right - film.clientWidth + 12;
    }
  }
  function step(by: number) {
    if (!piece) return;
    const at = piece.parts.findIndex(p => p.n === st.selected), next = (at + by + piece.parts.length) % piece.parts.length;
    select(piece.parts[next]!.n);
  }
  function turnTo(name: MakeViewName) {
    const goal = MAKE_VIEWS[name], from = { ...st.view }, start = performance.now();
    st.named = name;
    if (ports.reducedMotion()) { st.view = { ...goal }; render(); return; }
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 320), e = 1 - Math.pow(1 - k, 3);
      st.view = { yaw: from.yaw + (goal.yaw - from.yaw) * e, pitch: from.pitch + (goal.pitch - from.pitch) * e };
      render();
      if (k < 1) ports.frame(tick);
    };
    ports.frame(tick);
  }

  // Drag turns the model; a tap that hardly moved picks the part under it; two fingers or the wheel zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean; target: Element | null } | null = null, pinch = 0;
  const focusAt = (clientX: number, clientY: number) => {
    const r = stage.getBoundingClientRect();
    st.focus = { x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)) };
  };
  listen(stage, 'pointerdown', e => {
    const p = e as PointerEvent;
    pointers.set(p.pointerId, { x: p.clientX, y: p.clientY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); drag = null; return; }
    drag = { x: p.clientX, y: p.clientY, yaw: st.view.yaw, pitch: st.view.pitch, moved: false, target: p.target as Element };
  });
  listen(stage, 'pointermove', e => {
    const p = e as PointerEvent;
    if (pointers.has(p.pointerId)) pointers.set(p.pointerId, { x: p.clientX, y: p.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      focusAt((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      st.zoom = Math.min(6, Math.max(1, st.zoom * d / pinch)); pinch = d; render(); return;
    }
    if (!drag) return;
    const dx = p.clientX - drag.x, dy = p.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; stage.setPointerCapture(p.pointerId); stage.classList.add('turning'); }
    if (!drag.moved) return;
    st.view = { yaw: drag.yaw - dx * .008, pitch: Math.max(-.15, Math.min(1.5, drag.pitch + dy * .006)) };
    st.named = '';
    render();
  });
  const end = (e: Event) => {
    const p = e as PointerEvent;
    pointers.delete(p.pointerId);
    if (pointers.size < 2) pinch = 0;
    stage.classList.remove('turning');
    if (drag && !drag.moved && e.type === 'pointerup') {
      const hit = drag.target?.closest('[data-n]') as HTMLElement | SVGElement | null;
      select(hit ? Number(hit.dataset.n) : null);
    }
    drag = null;
  };
  listen(stage, 'pointerup', end);
  listen(stage, 'pointercancel', end);
  listen(stage, 'wheel', e => {
    const w = e as WheelEvent;
    w.preventDefault();
    focusAt(w.clientX, w.clientY);
    st.zoom = Math.min(6, Math.max(1, st.zoom * Math.exp(-w.deltaY * .0015)));
    render();
  }, { passive: false });
  listen(stage, 'dblclick', () => { st.zoom = 1; render(); });
  listen(views, 'click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-view]'); if (b) turnTo(b.dataset.view as MakeViewName); });
  listen(film, 'click', e => { const t = (e.target as Element).closest<HTMLElement>('[data-n]'); if (t) select(Number(t.dataset.n)); });
  listen(dock, 'click', e => {
    const t = e.target as Element, stepBy = t.closest<HTMLElement>('[data-step]'), band = t.closest<HTMLElement>('[data-band]');
    if (stepBy) step(Number(stepBy.dataset.step));
    else if (t.closest('[data-clear]')) select(null);
    else if (band) { ports.band.set(Number(band.dataset.band)); renderDock(); }
    else if (t.closest('[data-sheet]') && st.selected !== null) ports.openSheet(st.selected);
    else if (t.closest('[data-furniture]')) ports.close();
  });
  listen(tools, 'input', e => {
    const range = e.target as HTMLInputElement;
    if (range.dataset.apart === undefined) return;
    st.apart = Number(range.value) / 100; render();
  });
  listen(tools, 'click', e => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-toggle]');
    if (!b) return;
    const key = b.dataset.toggle as 'solidFronts' | 'measures' | 'numbers';
    st[key] = !st[key];
    b.setAttribute('aria-pressed', String(st[key]));
    render();
  });

  return {
    show(next: MakePiece) {
      piece = next;
      Object.assign(st, { view: { ...MAKE_VIEWS.iso }, named: 'iso', apart: 0, selected: null, zoom: 1, focus: { x: .5, y: .5 } });
      const range = tools.querySelector<HTMLInputElement>('[data-apart]');
      if (range) range.value = '0';
      renderFilm(); renderDock(); render();
    },
    render() { renderFilm(); renderDock(); render(); },
    select,
    step,
    get selected() { return st.selected; },
  };
}
