import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import type { MakeLook, createMake3d } from './make-3d';
import type { MakePlayer } from './make-player';
import type { MakeViewPorts } from './make-view.ports';
import type { Pose } from './make-director';
import { createAssemblyStudio } from './assembly-studio';

interface StudioState {
  piece: MakePiece | null; studio: boolean; explore: boolean; look: MakeLook; measures: boolean; numbers: boolean;
  selected: number | null; apartOn: boolean; openOn: boolean; panel: 'closed' | 'list' | 'part'; marks: string;
  glide: { from: Pose; left: number } | null; follow: boolean;
}
interface Host {
  st: StudioState; player: MakePlayer; make3d: ReturnType<typeof createMake3d>; app: HTMLElement; view: HTMLElement;
  ports: MakeViewPorts; reducedMotion: { readonly matches: boolean };
  hidePanel(): void; showPanel(mode: 'list' | 'part'): void; filming(): void; paper(on: boolean): void;
  showFilm(): void; followFrom(pose: Pose): void; length(cm: number): string; material(id: string): string;
  /** The gate into assembly: false when something blocks building the piece (the host then shows what). */
  mayAssemble(): boolean;
}
/** Studio changes presentation only. The host owns the single scene, timeline and editor state. */
export function createStudioController(host: Host) {
  const { st, player, make3d, app, view, ports, reducedMotion, hidePanel, showPanel, filming, paper, showFilm, followFrom, length, material } = host;
  const studio = createAssemblyStudio(app.ownerDocument, studioAction);
  app.append(studio.root);
  let saved: {
    pose: Pose; look: MakeLook; measures: boolean; numbers: boolean; selected: number | null;
    apartOn: boolean; openOn: boolean; panel: StudioState['panel']; canvasLabel: string; focus: HTMLElement | null;
  } | null = null;
  let historyPending = false, visited: MakePiece | null = null;
  const history = app.ownerDocument.defaultView!.history, historyKey = 'furnidrawAssemblyStudio';
  const inertBefore = new Map<HTMLElement, boolean>();
  function stageForPart(n: number) {
    const part = st.piece?.parts.find(p => p.n === n);
    return part ? st.piece!.steps.findIndex(step => step.boards.some(i => part.ids.includes(i))) : 0;
  }
  function enterStudio(chapter?: number, push = true) {
    if (!st.piece || historyPending) return;
    // Every way in passes the gate: the tool, a part's stage link, a hardware row, the browser's Forward.
    if (!st.studio && !host.mayAssemble()) return;
    const firstVisit = visited !== st.piece; visited = st.piece;
    if (!st.studio) {
      saved = { pose: { ...ports.camera.camNow() }, look: st.look, measures: st.measures, numbers: st.numbers, selected: st.selected,
        apartOn: st.apartOn, openOn: st.openOn, panel: st.panel, canvasLabel: ports.resources.cv.getAttribute('aria-label') ?? '', focus: (app.getRootNode() as ShadowRoot).activeElement as HTMLElement | null };
      hidePanel();
      ports.camera.camRelease();
      Object.assign(st, { studio: true, explore: false, look: 'material', measures: false, numbers: false, selected: null });
      make3d.setSelected(null); make3d.setLook('material');
      app.classList.add('assembly-studio-on');
      for (const child of Array.from(app.children)) if (child instanceof HTMLElement && child !== view && child !== studio.root) {
        inertBefore.set(child, child.inert); child.inert = true;
      }
      studio.root.hidden = false;
      ports.resources.cv.setAttribute('aria-label', 'Interactive assembly. Switch to Explore to orbit, pan, zoom and inspect components.');
      studio.load(st.piece, player);
      paper(true);
      if (push) history.pushState({ ...history.state, [historyKey]: true }, '');
      filming();
      studio.root.querySelector<HTMLButtonElement>('[data-studio="exit"]')?.focus({ preventScroll: true });
    }
    if (chapter !== undefined && chapter >= 0) { player.pause(); player.chapter(chapter); }
    else if (firstVisit && !reducedMotion.matches && !player.playing) { player.direction(1); player.toggle(); }
    showFilm();
  }
  function leaveStudio(back = true) {
    if (!st.studio) return;
    player.pause(); st.studio = false; st.explore = false;
    studio.root.hidden = true; app.classList.remove('assembly-studio-on');
    for (const [el, inert] of inertBefore) el.inert = inert;
    inertBefore.clear();
    if (saved) {
      const restore = saved; saved = null;
      Object.assign(st, { look: restore.look, measures: restore.measures, numbers: restore.numbers, selected: restore.selected,
        apartOn: restore.apartOn, openOn: restore.openOn, marks: '' });
      make3d.setLook(st.look); make3d.setSelected(st.selected); paper(true);
      ports.camera.cameraTransition(restore.pose, reducedMotion.matches ? 0 : 300);
      if (restore.panel !== 'closed') showPanel(restore.panel);
      ports.resources.cv.setAttribute('aria-label', restore.canvasLabel);
      const focus = restore.focus?.isConnected ? restore.focus : app.querySelector<HTMLElement>(
        restore.panel === 'part' ? '[data-assembly-part]' : restore.panel === 'list' ? '[data-assembly]' : '[data-action="make-assembly"]');
      focus?.focus({ preventScroll: true });
    }
    // After Make's toggles are back as they were, so the toolbar shows them pressed again (Sizes, Doors).
    filming();
    if (back && history.state?.[historyKey]) { historyPending = true; history.back(); }
  }
  function explore(on: boolean) {
    st.explore = on; player.pause(); st.glide = null; st.follow = !on;
    if (!on) { st.selected = null; make3d.setSelected(null); studio.inspect(st.piece!, null, length, material); followFrom(ports.camera.camNow()); }
    showFilm(); studio.wake();
  }
  function focusPart() {
    const box = make3d.currentExtent(st.selected), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const now = ports.camera.camNow();
    const pose = fittedCamera(now.az, now.el, 1.12, { x: c.x, y: c.y, z: c.z, w: Math.max(12, size.x), h: Math.max(12, size.y), d: Math.max(12, size.z) });
    ports.camera.cameraTransition(pose, reducedMotion.matches ? 0 : 500);
  }
  function inspect(n: number | null) {
    if (!st.piece) return;
    if (!st.explore) explore(true);
    st.selected = n; make3d.setSelected(n); st.marks = '';
    studio.inspect(st.piece, n, length, material);
    if (n !== null) focusPart();
    studio.wake();
  }
  function studioAction(action: string, value = 0) {
    if (!st.piece || !st.studio) return;
    if (action === 'exit') { leaveStudio(); return; }
    if (action === 'mode') { explore(!st.explore); return; }
    if (action === 'part') { inspect(value); return; }
    if (action === 'deselect') { inspect(null); return; }
    if (action === 'part-stage') { explore(false); player.chapter(stageForPart(value)); }
    if (action === 'play' || action === 'reverse') {
      if (st.explore) explore(false);
      if (action === 'reverse') { player.direction(player.rate === -1 ? 1 : -1); if (!player.playing) player.toggle(); }
      else player.toggle();
    }
    if (action === 'pause') player.pause();
    if (action === 'seek') { player.pause(); player.seek(value * player.duration); }
    if (action === 'chapter') { explore(false); player.chapter(value); }
    if (action === 'previous' || action === 'next') { player.pause(); player.step(action === 'previous' ? -1 : 1); }
    if (action === 'fit') { explore(true); focusPart(); }
    if (action === 'connection') {
      explore(false);
      const step = player.timeline?.steps[player.head.step], fix = step?.fixes.find(f => f.at[1] > player.time) ?? step?.fixes[0];
      if (fix) player.seek((fix.at[0] + fix.at[1]) / 2);
    }
    showFilm(); studio.wake();
  }
  /** Fit the real bounds using the editor's projection math, reserving only the floating controls' actual space. */
  function fittedCamera(az: number, el: number, padding: number, box: NonNullable<Parameters<MakeViewPorts['camera']['fittedCamera']>[3]>): Pose {
    const W = view.clientWidth, H = view.clientHeight;
    const panel = studio.root.querySelector<HTMLElement>('.as-bottom')!, header = studio.root.querySelector<HTMLElement>('.as-header')!;
    const landscape = H <= 600 && W >= 600;
    const left = 18, top = header.offsetTop + header.offsetHeight + 14;
    const width = Math.max(120, W - (landscape ? panel.offsetWidth + 48 : 36));
    const height = Math.max(100, (landscape ? H - 18 : panel.offsetTop - 16) - top);
    const dist = ports.camera.cameraFitDistance(box, az, el, width / height, 24) * H / height * Math.max(1.02, padding);
    const perPx = 2 * dist * Math.tan(35 * Math.PI / 360) / H;
    const dx = (W / 2 - left - width / 2) * perPx, dy = (top + height / 2 - H / 2) * perPx;
    return { az, el, dist, x: box.x + Math.cos(az) * dx - Math.sin(az) * Math.sin(el) * dy,
      y: (box.y ?? box.h / 2) + Math.cos(el) * dy, z: box.z - Math.sin(az) * dx - Math.cos(az) * Math.sin(el) * dy };
  }
  function historyChanged(e: Event) {
    if (st.studio) { e.stopImmediatePropagation(); leaveStudio(false); }
    else if (historyPending) { historyPending = false; e.stopImmediatePropagation(); }
    else if (history.state?.[historyKey] && st.piece) { e.stopImmediatePropagation(); enterStudio(undefined, false); }
  }
  return { studio, enterStudio, leaveStudio, inspect, stageForPart, studioAction, historyChanged, fittedCamera };
}
