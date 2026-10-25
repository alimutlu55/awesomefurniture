import type { EditorScene } from '../../application/projects/editor-scene';
import type { Sheet } from '../../domain/drawings/drawing';
import { furnitureModule } from '../../domain/furniture/furniture';
import { type SheetSetInfo, sheetMarks } from './sheet-marks';
import { marksToSvg } from './paper-marks';
import { type DrawingRelease, releaseCurrent, releaseDrawings } from './drawing-release';
import { marksToPdf } from './pdf-writer';
import { PAPER } from './sheet-layout';
import { paginateDrawingSheets } from './table-marks';
import { drawingGestures } from './drawing-gestures';
import type { AnnotationOffsets } from './annotation-layout';
import type { CreditWalletApi } from '../credits/credit-wallet';
import type { CreditFeatureKey } from '../../domain/credits/credit-catalog';
import { createLoadingPlaceholder, createLoadingState, paintLoading } from '../components/loading-state';

interface Ports {
  /** The editor's controls, and the page it is mounted in (a download link belongs to the page). */
  dom: { $(selector: string): HTMLElement; document: { createElement: Document['createElement'] }; host: HTMLElement };
  lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void; cleanup(callback: () => void): void };
  /** The scene the drawings are made from, read when they open. */
  scene(): EditorScene;
  closeMenu(): void;
  /** Pays for a drawing set (the first is free; a design stays open for its pass). Absent: drawings are free. */
  credits?: CreditWalletApi | null;
}
const FEATURE: CreditFeatureKey = 'technical-drawings';

const ZOOMS = [1, 1.6, 2.5, 4, 6] as const, MIN_ZOOM = 1, MAX_ZOOM = 6;
const ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM4 15h5v5M9 4v6h6M15 10v10"/></svg>';

/** What the title block calls the set: what is in it ("Cabinets and Wardrobe design"). */
function project(scene: EditorScene) {
  const labels = [...new Set(scene.wardrobes.map(c => furnitureModule(c.state).label))];
  return (labels.length ? labels.join(' and ') : 'Room') + ' design';
}

/** Every sheet as one page of an A3 landscape PDF, the same marks the screen shows. */
export function drawingsPdf(sheets: readonly Sheet[], info: SheetSetInfo, offsets: AnnotationOffsets = {}) {
  const pages = paginateDrawingSheets(sheets), set = { ...info, total: pages.length };
  return marksToPdf(pages.map(s => sheetMarks(s, set, offsets)), { w: PAPER.w, h: PAPER.h }, info.project + ' - technical drawings');
}
/** A file name for the set: "cabinets-design-technical-drawings.pdf". */
const fileName = (project: string) => project.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-technical-drawings.pdf';

/** "Technical drawings" in the editor menu: the design as a carpenter's drawing set (plan and wall elevations, every
 * dimension in millimetres) on A3 sheets to read on screen, zoomed, and saved as a PDF file the app writes itself. */
export function bindDrawingsViewer({ dom, lifetime, scene, closeMenu, credits = null }: Ports) {
  const { document } = dom, page = dom.host.ownerDocument, menu = dom.$('#menu'), item = document.createElement('button');
  item.className = 'mi'; item.type = 'button'; item.setAttribute('role', 'menuitem');
  item.innerHTML = ICON + '<span>Technical drawings</span>';
  const group = menu.querySelector('[data-menu-group="design"]') ?? menu;
  group.insertBefore(item, group.querySelector('[data-editor-id="share-menu"]'));
  credits?.badge(item, FEATURE);

  const panel = document.createElement('div');
  panel.className = 'drawings'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Technical drawings');
  panel.innerHTML = '<header class="drawings-bar"><div class="drawings-title"><h2>Technical drawings</h2><span class="drawings-count"></span></div>'
    + '<div class="drawings-tools"><div class="drawings-zoom" role="group" aria-label="Zoom"><button type="button" data-zoom="-1" aria-label="Zoom out">−</button>'
    + '<button type="button" data-zoom="1" aria-label="Zoom in">+</button></div><button type="button" class="drawings-pdf">Save as PDF</button></div>'
    + '<button type="button" class="drawings-close" aria-label="Close technical drawings">×</button></header>'
    + '<p class="drawings-release" role="status" hidden></p>'
    + '<div class="drawings-sheets" tabindex="0" aria-label="Sheets"></div>';
  dom.$('#app').append(panel);
  const list = panel.querySelector<HTMLElement>('.drawings-sheets')!, count = panel.querySelector<HTMLElement>('.drawings-count')!;
  const release = panel.querySelector<HTMLElement>('.drawings-release')!, save = panel.querySelector<HTMLButtonElement>('.drawings-pdf')!;
  let scale = 1, current: DrawingRelease | null = null;
  const saveLoading = createLoadingState(save);
  let disposed = false, generation = 0;

  /** Zooms to `level` (1: a sheet as wide as the view), keeping the point at `focus` (in the list's box) where it is. */
  const zoomTo = (level: number, focus = { x: list.clientWidth / 2, y: list.clientHeight / 2 }) => {
    const before = scale, next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)), x = list.scrollLeft + focus.x, y = list.scrollTop + focus.y;
    scale = next;
    list.style.setProperty('--sheet-zoom', String(next));
    list.scrollLeft = x * next / before - focus.x;
    list.scrollTop = y * next / before - focus.y;
    panel.querySelector<HTMLButtonElement>('[data-zoom="-1"]')!.disabled = next <= MIN_ZOOM + .001;
    panel.querySelector<HTMLButtonElement>('[data-zoom="1"]')!.disabled = next >= MAX_ZOOM - .001;
  };
  const step = (dir: number) => zoomTo(dir > 0 ? ZOOMS.find(z => z > scale + .01) ?? MAX_ZOOM : [...ZOOMS].reverse().find(z => z < scale - .01) ?? MIN_ZOOM);
  /** Makes the set from the scene as it is now, checked for manufacture (drawing-release.ts). */
  function build() {
    const s = scene();
    current = releaseDrawings(s, project(s), new Date().toLocaleDateString());
    const { pages, marks, validation } = current, blocking = validation.findings.filter(f => f.severity === 'critical');
    // Each sheet is its own SVG document, as it prints: its hatching and styles resolve inside it, not in the editor.
    list.innerHTML = pages.map((sheet, i) => '<figure class="drawings-sheet"><img alt="' + (sheet.number + ' ' + sheet.title).replace(/"/g, '') + '" src="data:image/svg+xml;charset=utf-8,'
      + encodeURIComponent(marksToSvg(marks[i]!, { w: PAPER.w, h: PAPER.h }, String(sheet.number), sheet.title)) + '"></figure>').join('');
    const checks = pages[0]?.issues?.length ?? 0;
    count.textContent = pages.length + (pages.length === 1 ? ' sheet' : ' sheets') + ' · A3 · mm' + (checks ? ' · ' + checks + (checks === 1 ? ' thing' : ' things') + ' to check' : '');
    count.classList.toggle('has-checks', checks > 0);
    // Fail closed: a set with blocking findings says so above the sheets, on every sheet and on the button.
    release.hidden = validation.ready;
    release.textContent = validation.ready ? '' : 'Not for manufacture: ' + blocking.length + (blocking.length === 1 ? ' blocking finding' : ' blocking findings') + '. '
      + blocking.slice(0, 3).map(f => f.message).join('; ') + (blocking.length > 3 ? '; see the Manufacturing check sheet' : '') + '.';
    save.textContent = validation.ready ? 'Save as PDF' : 'Save review PDF';
    save.title = validation.ready ? 'Save the drawings, checked for manufacture' : 'Save the drawings marked NOT FOR MANUFACTURE';
  }
  let opening = false;
  async function open() {
    closeMenu();
    if (opening) return;
    opening = true;
    const token = ++generation;
    try {
      if (credits && !await credits.charge(FEATURE)) return;
      if (disposed || token !== generation) return;
      list.replaceChildren(createLoadingPlaceholder(page, 'Preparing your drawings…', 'canvas'));
      count.textContent = 'Preparing your drawings…'; panel.hidden = false; save.disabled = true;
      panel.querySelector<HTMLButtonElement>('.drawings-close')!.focus();
      await paintLoading(panel);
      if (disposed || panel.hidden || token !== generation) return;
      build(); scale = 1; zoomTo(1); list.scrollTo(0, 0);
    } catch {
      list.replaceChildren(); current = null;
      count.textContent = 'Drawings could not be prepared. Close and try again.';
    } finally { opening = false; save.disabled = !current; }
  }
  const close = () => { generation++; panel.hidden = true; list.innerHTML = ''; current = null; item.focus(); };
  /** Writes the PDF and hands it over: through the share sheet on a phone (Save to Files, Mail), downloaded elsewhere.
   * The file is made from the sheets, not from the screen, so the zoom or scroll of the viewer never changes it; a set
   * made from an older model revision is made again first, so a file never shows stale geometry. */
  async function savePdf() {
    if (!current) return;
    if (!releaseCurrent(current, scene())) build();
    const name = fileName(current.info.project), bytes = marksToPdf(current.marks, { w: PAPER.w, h: PAPER.h }, current.info.project + ' - technical drawings');
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }), win = page.defaultView;
    const file = typeof File === 'function' ? new File([blob], name, { type: 'application/pdf' }) : null, nav = win?.navigator;
    if (file && nav?.canShare?.({ files: [file] }) && win?.matchMedia('(pointer: coarse)').matches) {
      try { await nav.share({ files: [file], title: name }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob), link = page.createElement('a');
    link.href = url; link.download = name; link.rel = 'noopener';
    page.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  lifetime.listen(item, 'click', () => { void open(); });
  lifetime.listen(panel.querySelector('.drawings-close')!, 'click', close);
  lifetime.listen(save, 'click', () => {
    if (saveLoading.active || !current) return;
    saveLoading.start(); save.disabled = true;
    void paintLoading(save).then(savePdf).catch(() => {
      release.hidden = false; release.textContent = 'The PDF could not be prepared. Please try again.';
    }).finally(() => { saveLoading.stop(); save.disabled = false; });
  });
  lifetime.listen(panel.querySelector('.drawings-zoom')!, 'click', e => {
    const dir = Number((e.target as HTMLElement).closest('button')?.dataset.zoom);
    if (dir) step(dir);
  });
  drawingGestures(list, lifetime, () => scale, zoomTo);
  lifetime.listen(panel, 'keydown', event => {
    const e = event as KeyboardEvent;
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')];
    const edge = e.shiftKey ? focusable[0] : focusable.at(-1), next = e.shiftKey ? focusable.at(-1) : focusable[0];
    if (page.activeElement === edge) { e.preventDefault(); next?.focus(); }
  });
  lifetime.cleanup(() => { disposed = true; generation++; saveLoading.stop(); item.remove(); panel.remove(); });
  return { open: () => { void open(); }, close };
}
