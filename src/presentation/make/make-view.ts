import * as THREE from 'three';
import { getDecor } from '../../domain/materials/decor-catalog';
import { cutLayout, type CutLayout } from '../../domain/make/make-cut-layout';
import { makePiece, type MakePiece } from '../../domain/make/make-parts';
import { lengthText, onLengthUnitChange } from '../editor/length-unit-state';
import { onLanguageChange } from '../i18n/language';
import { mountMobileSheet } from '../editor/mobile-sheet.js';
import { animateMobileSheetClose } from '../editor/mobile-sheet-motion.js';
import { createMake3d, MAKE_LAYER, type MakeLook } from './make-3d';
import { marksSvg, type Projector } from './make-marks';
import { partDetail, pieceTabs } from './make-panel';
import { type PanelTab, updatePlayer } from './make-panel-tabs';
import { createMakePlayer } from './make-player';
import { planShots, type Pose } from './make-director';
import type { MakeViewPorts } from './make-view.ports';
import { cutListCsv, makePdf } from './make-export';
import { saveFile } from '../components/save-file';

const GLIDE = .9, BAND_KEY = 'furnidraw.make.band', SVG = 'http://www.w3.org/2000/svg';
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

  const st = { piece: null as MakePiece | null, pose: { x: 0, y: 0, z: 0, angle: 0 }, look: 'lines' as MakeLook, apartOn: false, apart: 0, openOn: false, open: 0,
    solidFronts: false, measures: true, numbers: false, selected: null as number | null, panel: 'closed' as 'closed' | 'list' | 'part', marks: '',
    id: -1, tab: 'parts' as PanelTab, cut: null as CutLayout | null, building: null as ReadonlySet<number> | null, filming: false,
    // The film's camera: following the director's shots, and gliding back to them after the person has looked around.
    follow: true, shots: null as ((t: number) => Pose) | null, shotsFor: '', glide: null as { from: Pose; left: number } | null };
  const player = createMakePlayer();
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
    const reduce = dom.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ease = (now: number, goal: number, rate: number) => reduce || Math.abs(goal - now) < .01 ? goal : now + (goal - now) * (1 - Math.exp(-dt * rate));
    if (st.apart !== (st.apartOn ? 1 : 0)) { st.apart = ease(st.apart, st.apartOn ? 1 : 0, 9); make3d.setApart(st.apart); }
    if (st.open !== (st.openOn ? 1 : 0)) { st.open = ease(st.open, st.openOn ? 1 : 0, 6); make3d.setOpen(st.open); }
    if (st.filming) {
      const size = `${view.clientWidth}x${view.clientHeight}x${panel.classList.contains('show')}`;
      if (size !== st.shotsFor) { plan(); st.shotsFor = size; }
      if (st.glide) st.glide.left -= dt;
      if (player.advance(dt) || st.glide) showFilm();
      if (st.glide && st.glide.left <= 0) st.glide = null;
    }
    camera.updateMatrixWorld();
    const w = view.clientWidth, h = view.clientHeight;
    make3d.setResolution(w, h);
    const key = camera.matrixWorld.elements.map(v => v.toFixed(2)).join() + camera.projectionMatrix.elements.slice(8, 10).map(v => v.toFixed(4)).join()
      + [w, h, st.apart.toFixed(3), st.open.toFixed(3), st.selected, st.measures, st.numbers, st.solidFronts, lengthText(100), [...st.building ?? []].join(':'), st.filming ? player.time.toFixed(2) : ''].join();
    if (key === st.marks) return;
    st.marks = key;
    overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
    overlay.innerHTML = marksSvg(st.piece, { ...st, open: st.open > .02 ? st.open : 0, fixing: st.filming ? player.fixing() : null }, projector(), b => make3d.offsetOf(b), length, { w, h, left: dockedLeft() });
  }

  function renderPanel() {
    if (!st.piece || st.panel === 'closed') return;
    const part = st.piece.parts.find(p => p.n === st.selected), showPart = st.panel === 'part' && !!part;
    panel.querySelector('.make-title')!.textContent = showPart ? `${part!.n} · ${part!.name}` : 'Parts';
    panel.querySelector<HTMLElement>('.make-back')!.hidden = !showPart;
    const piece = st.piece, shown = { piece, selected: st.selected, band, length, material, tab: st.tab, player, cut: () => st.cut ??= cutLayout(piece.parts) };
    panel.querySelector('.make-body')!.innerHTML = showPart ? partDetail(shown) : pieceTabs(shown);
    filming();
  }
  /** The Steps tab plays the assembly as a film: the piece assembled and opened, the camera backed off far enough to
   * see every board come in; leaving it shows the piece as it is again. */
  function filming() {
    const on = !!st.piece && st.panel === 'list' && st.tab === 'steps';
    if (on === st.filming) { if (on) showFilm(); return; }
    st.filming = on;
    if (on) {
      Object.assign(st, { apartOn: false, apart: 0, openOn: false, open: 0, follow: true, shotsFor: '' });
      make3d.setApart(0); make3d.setOpen(0);
      plan();
      followFrom(ports.camera.camNow());
      showFilm();
    } else {
      player.pause();
      make3d.setFilm(null);
      st.building = null; st.marks = '';
    }
    pressed();
  }
  /** Shows the film at the player's time: the piece, the part numbers it puts in, the director's shot (gliding into
   * it from where the person left the camera), and the player's controls. */
  function showFilm() {
    if (!st.piece || !st.filming) return;
    make3d.setFilm(player.film());
    st.building = player.building();
    if (st.follow && st.shots) {
      const pose = st.shots(player.time);
      ports.camera.cameraTransition(st.glide ? ports.camera.cameraSample(st.glide.from, pose, 1 - Math.max(0, st.glide.left) / GLIDE) : pose, 0);
    }
    updatePlayer(panel, st.piece, player, st.follow);
  }
  /** The director's shots for the piece where it stands, fitted to the view as it is now: on a desktop, to the room
   * beside the docked panel, each shot moved into the middle of that room. */
  function plan() {
    const tl = player.timeline;
    if (!st.piece || !tl) return;
    make3d.group.updateMatrixWorld(true);
    const W = view.clientWidth, H = view.clientHeight, left = dockedLeft();
    const room = Math.max(W * .4, W - left - 36), tanV = Math.tan(35 * Math.PI / 360);
    const camera = {
      cameraSample: ports.camera.cameraSample,
      fittedCamera(az: number, el: number, padding: number, box: Parameters<typeof ports.camera.fittedCamera>[3]) {
        const pose = ports.camera.fittedCamera(az, el, padding * W / room, box), px = (W - room) / 2, perPx = 2 * pose.dist * tanV / H;
        return { ...pose, x: pose.x - Math.cos(az) * px * perPx, z: pose.z + Math.sin(az) * px * perPx };
      },
    };
    st.shots = planShots(camera, st.piece, tl, player.staged, p => make3d.group.localToWorld(p), st.pose.angle * Math.PI / 180);
  }
  /** How much of the view the panel covers at its left, docked beside it on a desktop (pixels). */
  function dockedLeft() {
    const docked = dom.matchMedia('(min-width:901px)').matches && panel.classList.contains('show');
    return docked ? Math.max(0, panel.getBoundingClientRect().right - view.getBoundingClientRect().left) : 0;
  }
  function followFrom(from: Pose) { st.follow = true; st.glide = { from: { ...from }, left: GLIDE }; }
  function showPanel(mode: 'list' | 'part') {
    st.panel = mode;
    renderPanel();
    if (!panel.classList.contains('show')) { panel.dataset.sheetPosition = 'compact'; panel.classList.add('show'); }
  }
  function hidePanel() {
    if (panel.classList.contains('show')) { animateMobileSheetClose(panel); panel.classList.remove('show'); }
    st.panel = 'closed';
    filming();
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
    set('make-apart', st.apartOn); set('make-open', st.openOn); set('make-fronts', st.solidFronts); set('make-measures', st.measures); set('make-parts', st.panel !== 'closed');
  }
  /** Squares the editor's camera on the piece: from the front, the side or above; 3D is the editor's own framing. */
  function look(at: View) {
    if (!st.piece) return;
    if (at === 'iso') { ports.camera.frameWardrobe(); return; }
    const angle = st.pose.angle * Math.PI / 180;
    ports.camera.frameBox(bounds(), angle + (at === 'side' ? Math.PI / 2 : 0), at === 'top' ? 1.35 : 0, 1.12);
  }
  /** The room the piece takes, assembled or taken apart (its boards spread out `apart` far). */
  function bounds(apart = st.apartOn ? 1 : 0) {
    const box = make3d.extent(apart), centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    return { x: centre.x, z: centre.z, w: size.x, d: size.z, h: size.y, y: centre.y };
  }

  /** In the Lines look the view is a sheet of paper, the editor's panel colour, the boards drawn in its ink; any other
   * look, or leaving Make, gives the editor's own backdrop back. */
  function paper(on: boolean) {
    const css = getComputedStyle(view), sheet = css.getPropertyValue('--panel').trim() || '#fbfbf8', ink = css.getPropertyValue('--ink').trim() || '#1a1a1a';
    make3d.setPaper(sheet, ink);
    if (on && st.look === 'lines') resources.R.setClearColor(sheet, 1);
    else resources.R.setClearColor(css.getPropertyValue('--scene').trim() || '#dce6ee', 0);
  }
  /** The piece with this id taken apart, from the design as it is now. */
  function pieceOf(id: number) {
    const s = ports.scene(), cabinet = s.wardrobes.find(c => c.id === id);
    const input = { studio: s.studio, pieces: s.wardrobes.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, design: c.state })) };
    return { cabinet, piece: cabinet ? makePiece(input, cabinet.id) : null };
  }
  function open() {
    const { cabinet, piece } = pieceOf(ports.scene().activeWardrobe);
    if (!piece || !cabinet) { ports.toast('Select a wardrobe or cabinet to make'); return; }
    ports.closePanels();
    Object.assign(st, { piece, pose: { x: cabinet.x, y: cabinet.y || 0, z: cabinet.z, angle: cabinet.angle }, apartOn: false, apart: 0, selected: null, marks: '',
      id: cabinet.id, tab: 'parts', cut: null, openOn: false, open: 0, filming: false });
    player.load(piece, -(cabinet.y || 0)); player.seek(0);
    make3d.show(piece, st.pose);
    make3d.setLook(st.look);
    make3d.setSolidFronts(st.solidFronts);
    paper(true);
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
    paper(false);
    overlay.innerHTML = '';
    app.classList.remove('make-on');
    Object.assign(st, { piece: null, selected: null, marks: '', cut: null });
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
    else if (key === 'make-open') st.openOn = !st.openOn;
    else if (key === 'make-parts') { if (st.panel === 'closed') showPanel(st.selected === null ? 'list' : 'part'); else hidePanel(); }
    else if (key.startsWith('look-')) { st.look = key.slice(5) as MakeLook; make3d.setLook(st.look); paper(true); }
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
    else if (t.closest<HTMLElement>('[data-tab]')) { st.tab = t.closest<HTMLElement>('[data-tab]')!.dataset.tab as PanelTab; renderPanel(); }
    else if (t.closest('[data-play]')) { player.toggle(); showFilm(); }
    else if (t.closest('[data-follow]')) { if (st.follow) st.follow = false; else followFrom(ports.camera.camNow()); showFilm(); }
    else if (t.closest<HTMLElement>('[data-build]')) { player.step(Number(t.closest<HTMLElement>('[data-build]')!.dataset.build)); showFilm(); }
    else if (t.closest<HTMLElement>('[data-chapter]')) { player.chapter(Number(t.closest<HTMLElement>('[data-chapter]')!.dataset.chapter)); showFilm(); }
    else if (t.closest<HTMLElement>('[data-joints],[data-back]')) construct(t.closest<HTMLElement>('[data-joints],[data-back]')!.dataset);
    else if (t.closest<HTMLElement>('[data-save]')) void save(t.closest<HTMLElement>('[data-save]')!.dataset.save as 'pdf' | 'csv');
  });
  /** Changes how the piece goes together (saved with the design, one undo step) and takes it apart again. */
  function construct(choice: DOMStringMap) {
    if (!st.piece) return;
    const change = choice.joints ? { joints: choice.joints } : { back: choice.back };
    if (!ports.setConstruction(st.id, change as Parameters<MakeViewPorts['setConstruction']>[1])) return;
    rebuild();
  }
  /** Takes the piece apart again from the design as it is now, keeping the view, the tab and the part picked. */
  function rebuild() {
    const { piece } = pieceOf(st.id);
    if (!piece) { close(); return; }
    const selected = st.selected !== null && piece.parts.some(p => p.n === st.selected) ? st.selected : null;
    Object.assign(st, { piece, cut: null, marks: '', shotsFor: '' });
    player.load(piece, -st.pose.y);
    make3d.show(piece, st.pose);
    make3d.setLook(st.look); make3d.setSolidFronts(st.solidFronts); make3d.setApart(st.apart); make3d.setOpen(st.open); make3d.setSelected(selected);
    st.selected = selected;
    renderPanel();
  }
  /** Saves the piece's drawings (PDF) or cut list (CSV): part of the paid drawing set. */
  async function save(kind: 'pdf' | 'csv') {
    const piece = st.piece;
    if (!piece || !await ports.pay() || st.piece !== piece) return;
    const title = ports.scene().wardrobes.find(c => c.id === st.id)?.name || 'Piece', name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'piece';
    const blob = kind === 'pdf'
      ? new Blob([makePdf(piece, { title, material, band, cut: st.cut ??= cutLayout(piece.parts) }).buffer as ArrayBuffer], { type: 'application/pdf' })
      : new Blob([cutListCsv(piece, material, band)], { type: 'text/csv' });
    await saveFile(view.ownerDocument, `${name}-${kind === 'pdf' ? 'make' : 'cut-list'}.${kind}`, blob);
  }
  // Something else closing the panel (the editor closes its panels on some gestures) closes it for Make too.
  lifetime.observe(new MutationObserver(() => { if (st.panel !== 'closed' && !panel.classList.contains('show')) { st.panel = 'closed'; filming(); pressed(); } }),
    panel, { attributes: true, attributeFilter: ['class'] });
  // Looking around while the film plays: the camera is the person's until they ask the director back (Follow).
  for (const type of ['pointerdown', 'wheel']) listen(resources.cv, type, () => { if (st.filming && st.follow) { st.follow = false; st.glide = null; showFilm(); } });
  // Scrubbing: the film follows the bar, paused, while it is dragged.
  listen(panel, 'input', e => {
    const bar = (e.target as Element).closest<HTMLInputElement>('.make-scrub');
    if (!bar) return;
    player.pause(); player.seek(Number(bar.value) / 1000 * player.duration); showFilm();
  });
  // While Make is open its keys come first, so the editor's shortcuts (delete, undo, nudge) never act on the design behind it.
  listen(dom.window, 'keydown', e => {
    const k = e as KeyboardEvent;
    if (!st.piece || (k.target as Element | null)?.closest?.('input,select,textarea')) return;
    // The film: Space plays or pauses (a focused button keeps its own Space), the arrows go a step back or on.
    if (st.filming && k.key === ' ' && !(k.target as Element | null)?.closest?.('button')) { player.toggle(); showFilm(); }
    else if (st.filming && (k.key === 'ArrowRight' || k.key === 'ArrowLeft')) { player.step(k.key === 'ArrowRight' ? 1 : -1); showFilm(); }
    else if (k.key === 'Tab' || k.key === 'Enter' || k.key === ' ') return;
    else if (k.key === 'Escape') { if (st.selected !== null) select(null); else close(); }
    else if ((k.key === 'ArrowRight' || k.key === 'ArrowLeft') && st.selected !== null) step(k.key === 'ArrowRight' ? 1 : -1);
    k.preventDefault();
    k.stopImmediatePropagation();
  }, true);
  // Changing between Studio and Furniture leaves Make.
  listen(dom.$('#view-modes'), 'click', () => close(), true);
  lifetime.cleanup(onLengthUnitChange(() => { st.marks = ''; renderPanel(); }));
  lifetime.cleanup(onLanguageChange(() => { st.marks = ''; }));
  lifetime.cleanup(() => { close(); make3d.dispose(); overlay.remove(); panel.remove(); });
  return { open, close, act, pick, get active() { return !!st.piece; } };
}
