import * as THREE from 'three';
import { getDecor } from '../../domain/materials/decor-catalog';
import { makePiece, type MakePiece } from '../../domain/make/make-parts';
import { lengthText, onLengthUnitChange } from '../editor/length-unit-state';
import { mountMobileSheet } from '../editor/mobile-sheet.js';
import { animateMobileSheetClose } from '../editor/mobile-sheet-motion.js';
import { createMake3d, MAKE_LAYER, type MakeLook } from './make-3d';
import { marksSvg, type Projector } from './make-marks';
import { partDetail, partsList } from './make-panel';
import type { MakeViewPorts } from './make-view.ports';

const BAND_KEY = 'furnidraw.make.band', SVG = 'http://www.w3.org/2000/svg';
const material = (id: string) => { try { return getDecor(id).name; } catch { return ''; } };
type View = 'iso' | 'front' | 'side' | 'top';

/**
 * Make: the selected wardrobe or cabinet taken down to its parts, inside the editor. Its boards replace the room in
 * the editor's own view (the editor's camera, gestures and light), measurements are written over them, the bottom
 * toolbar holds Make's tools, and a part's sizes and drawing open in the editor's own panel. Make reads the design and
 * never changes it; Done (or Escape, or Studio | Furniture) puts the editor back as it was.
 */
export function createMakeView(ports: MakeViewPorts) {
  const { dom, lifetime, resources } = ports, doc = dom.document;
  type Target = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  const listen = lifetime.listen as (target: Target, event: string, handler: (e: Event) => void, options?: boolean | AddEventListenerOptions) => void;
  const app = dom.$('#app'), view = dom.$('#view');
  const make3d = createMake3d(resources, resources.scene);
  const overlay = doc.createElementNS(SVG, 'svg') as SVGSVGElement;
  overlay.setAttribute('class', 'make-overlay');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('translate', 'no');
  view.append(overlay);
  const panel = doc.createElement('div');
  panel.className = 'pop editor-panel make-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Parts');
  panel.innerHTML = '<div class="ph"><b class="make-title">Parts</b><span class="pbtns"><button type="button" class="make-back" aria-label="All parts" title="All parts">‹</button>'
    + '<button type="button" class="make-close" aria-label="Close" title="Close">×</button></span></div><div class="make-body"></div>';
  app.append(panel);
  mountMobileSheet({ document: doc, lifetime, panel, name: 'Parts', close: () => hidePanel(), bottom: true, scene: app, docked: dom.matchMedia('(min-width:901px)') });

  const st = { piece: null as MakePiece | null, pose: { x: 0, y: 0, z: 0, angle: 0 }, look: 'lines' as MakeLook, apartOn: false, apart: 0,
    solidFronts: false, measures: true, numbers: false, selected: null as number | null, panel: 'closed' as 'closed' | 'list' | 'part', marks: '' };
  let band = (() => { try { return Number(globalThis.localStorage?.getItem(BAND_KEY)) || 0; } catch { return 0; } })();
  const length = (cm: number) => lengthText(cm);
  const raycaster = new THREE.Raycaster(), local = new THREE.Vector3();

  /** A point of the piece (centimetres from its left face, floor and back) where the editor's camera shows it. */
  function projector(): Projector {
    const piece = st.piece!, w = view.clientWidth, h = view.clientHeight;
    // The camera in the piece's frame, to tell which way each measured plane faces it.
    const eye = make3d.group.worldToLocal(resources.cam.position.clone()).add(new THREE.Vector3(piece.size.w / 2, 0, piece.size.d / 2));
    const pr: Projector = p => {
      local.set(p[0] - piece.size.w / 2, p[1], p[2] - piece.size.d / 2).applyMatrix4(make3d.group.matrixWorld).project(resources.cam);
      return local.z > 1 || local.z < -1 ? false : [(local.x + 1) / 2 * w, (1 - local.y) / 2 * h];
    };
    pr.facing = (at, n) => {
      const dx = eye.x - at[0], dy = eye.y - at[1], dz = eye.z - at[2], l = Math.hypot(dx, dy, dz) || 1;
      return (dx * n[0] + dy * n[1] + dz * n[2]) / l;
    };
    return pr;
  }
  /** Runs every frame while Make is open, after the camera has moved: eases the piece apart, and rewrites the marks
   * when the view, the size or what is shown has changed. */
  function frame(camera: THREE.PerspectiveCamera, dt: number) {
    if (!st.piece) return;
    const goal = st.apartOn ? 1 : 0;
    if (st.apart !== goal) {
      const reduce = dom.matchMedia('(prefers-reduced-motion: reduce)').matches;
      st.apart = reduce || Math.abs(goal - st.apart) < .01 ? goal : st.apart + (goal - st.apart) * (1 - Math.exp(-dt * 9));
      make3d.setApart(st.apart);
    }
    camera.updateMatrixWorld();
    const w = view.clientWidth, h = view.clientHeight;
    const key = camera.matrixWorld.elements.map(v => v.toFixed(2)).join() + camera.projectionMatrix.elements.slice(8, 10).map(v => v.toFixed(4)).join()
      + [w, h, st.apart.toFixed(3), st.selected, st.measures, st.numbers, st.solidFronts, lengthText(100)].join();
    if (key === st.marks) return;
    st.marks = key;
    overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
    overlay.innerHTML = marksSvg(st.piece, st, projector(), b => make3d.offsetOf(b), length, { w, h });
  }

  function renderPanel() {
    if (!st.piece || st.panel === 'closed') return;
    const part = st.piece.parts.find(p => p.n === st.selected), showPart = st.panel === 'part' && !!part;
    panel.querySelector('.make-title')!.textContent = showPart ? `${part!.n} · ${part!.name}` : 'Parts';
    panel.querySelector<HTMLElement>('.make-back')!.hidden = !showPart;
    const shown = { piece: st.piece, selected: st.selected, band, length, material };
    panel.querySelector('.make-body')!.innerHTML = showPart ? partDetail(shown) : partsList(shown);
  }
  function showPanel(mode: 'list' | 'part') {
    st.panel = mode;
    renderPanel();
    if (!panel.classList.contains('show')) { panel.dataset.sheetPosition = 'compact'; panel.classList.add('show'); }
  }
  function hidePanel() {
    if (panel.classList.contains('show')) { animateMobileSheetClose(panel); panel.classList.remove('show'); }
    st.panel = 'closed';
    pressed();
  }
  function select(n: number | null) {
    st.selected = n;
    make3d.setSelected(n);
    if (n === null) hidePanel(); else showPanel('part');
    pressed();
  }
  function step(by: number) {
    if (!st.piece) return;
    const parts = st.piece.parts, at = parts.findIndex(p => p.n === st.selected);
    select(parts[(at + by + parts.length) % parts.length]!.n);
  }
  /** Marks Make's toggles in the bottom toolbar as on or off. */
  function pressed() {
    const set = (key: string, on: boolean) => doc.querySelector(`[data-action="${key}"]`)?.setAttribute('aria-pressed', String(on));
    set('make-apart', st.apartOn); set('make-fronts', st.solidFronts); set('make-measures', st.measures); set('make-parts', st.panel !== 'closed');
  }
  /** Squares the editor's camera on the piece: from the front, the side or above; 3D is the editor's own framing. */
  function look(at: View) {
    if (!st.piece) return;
    if (at === 'iso') { ports.camera.frameWardrobe(); return; }
    const angle = st.pose.angle * Math.PI / 180;
    ports.camera.frameBox(bounds(), angle + (at === 'side' ? Math.PI / 2 : 0), at === 'top' ? 1.35 : 0, 1.12);
  }
  /** The room the piece takes, assembled or taken apart (its boards spread out about this far). */
  function bounds() {
    const box = make3d.extent(st.apartOn ? 1 : 0), centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    return { x: centre.x, z: centre.z, w: size.x, d: size.z, h: size.y, y: centre.y };
  }

  function open() {
    const s = ports.scene(), cabinet = s.wardrobes.find(c => c.id === s.activeWardrobe);
    const input = { studio: s.studio, pieces: s.wardrobes.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, design: c.state })) };
    const piece = cabinet ? makePiece(input, cabinet.id) : null;
    if (!piece || !cabinet) { ports.toast('Select a wardrobe or cabinet to make'); return; }
    ports.closePanels();
    Object.assign(st, { piece, pose: { x: cabinet.x, y: cabinet.y || 0, z: cabinet.z, angle: cabinet.angle }, apartOn: false, apart: 0, selected: null, marks: '' });
    make3d.show(piece, st.pose);
    make3d.setLook(st.look);
    make3d.setSolidFronts(st.solidFronts);
    resources.scene.traverse(o => { if ((o as THREE.Light).isLight) o.layers.enable(MAKE_LAYER); });
    resources.cam.layers.set(MAKE_LAYER);
    resources.frameHooks.add(frame);
    app.classList.add('make-on');
    ports.refreshToolbar();
    pressed();
    ports.camera.frameWardrobe();
  }
  function close() {
    if (!st.piece) return;
    hidePanel();
    resources.frameHooks.delete(frame);
    resources.cam.layers.set(0);
    make3d.hide();
    overlay.innerHTML = '';
    app.classList.remove('make-on');
    Object.assign(st, { piece: null, selected: null, marks: '' });
    ports.refreshToolbar();
    ports.camera.frameWardrobe();
  }
  /** A tool from the bottom toolbar or its View menu. */
  function act(key: string) {
    if (!st.piece) return;
    if (key === 'make-done') { close(); return; }
    if (key === 'make-apart') {
      st.apartOn = !st.apartOn;
      // The camera keeps its angle and backs away (or comes back) so the whole piece stays in view.
      const now = ports.camera.camNow();
      ports.camera.frameBox(bounds(), now.az, now.el, 1.04);
    }
    else if (key === 'make-fronts') { st.solidFronts = !st.solidFronts; make3d.setSolidFronts(st.solidFronts); }
    else if (key === 'make-measures') st.measures = !st.measures;
    else if (key === 'make-numbers') st.numbers = !st.numbers;
    else if (key === 'make-parts') { if (st.panel === 'closed') showPanel(st.selected === null ? 'list' : 'part'); else hidePanel(); }
    else if (key.startsWith('look-')) { st.look = key.slice(5) as MakeLook; make3d.setLook(st.look); }
    else if (key.startsWith('view-')) look(key.slice(5) as View);
    st.marks = '';
    pressed();
  }
  /** A tap on the canvas while Make is open: the part under it, or nothing. */
  function pick(e: { clientX: number; clientY: number }) {
    if (!st.piece) return;
    const r = resources.cv.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), resources.cam);
    select(make3d.pick(raycaster));
  }

  listen(panel, 'click', e => {
    const t = e.target as Element, row = t.closest<HTMLElement>('[data-n]'), bandButton = t.closest<HTMLElement>('[data-band]'), stepBy = t.closest<HTMLElement>('[data-step]');
    if (t.closest('.make-close')) hidePanel();
    else if (t.closest('.make-back')) { st.selected = null; make3d.setSelected(null); showPanel('list'); }
    else if (row) select(Number(row.dataset.n));
    else if (bandButton) { band = Number(bandButton.dataset.band); try { globalThis.localStorage?.setItem(BAND_KEY, String(band)); } catch { /* private window */ } renderPanel(); }
    else if (stepBy) step(Number(stepBy.dataset.step));
    else if (t.closest('[data-set]')) ports.openDrawings();
  });
  // While Make is open its keys come first, so the editor's shortcuts (delete, undo, nudge) never act on the design behind it.
  listen(dom.window, 'keydown', e => {
    const k = e as KeyboardEvent;
    if (!st.piece || (k.target as Element | null)?.closest?.('input,select,textarea')) return;
    if (k.key === 'Tab' || k.key === 'Enter' || k.key === ' ') return;
    if (k.key === 'Escape') { if (st.selected !== null) select(null); else close(); }
    else if ((k.key === 'ArrowRight' || k.key === 'ArrowLeft') && st.selected !== null) step(k.key === 'ArrowRight' ? 1 : -1);
    k.preventDefault();
    k.stopImmediatePropagation();
  }, true);
  // Changing between Studio and Furniture leaves Make.
  listen(dom.$('#view-modes'), 'click', () => close(), true);
  lifetime.cleanup(onLengthUnitChange(() => { st.marks = ''; renderPanel(); }));
  lifetime.cleanup(() => { close(); make3d.dispose(); overlay.remove(); panel.remove(); });
  return { open, close, act, pick, get active() { return !!st.piece; } };
}
