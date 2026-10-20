import type { EditorScene } from '../../application/projects/editor-scene';
import type { Sheet } from '../../domain/drawings/drawing';
import { technicalDrawings } from '../../domain/drawings/technical-drawings';
import { furnitureModule } from '../../domain/furniture/furniture';
import { type SheetSetInfo, sheetMarks, sheetSvg } from './sheet-marks';
import { marksToPdf } from './pdf-writer';
import { PAPER } from './sheet-layout';
import { paginateDrawingSheets } from './table-marks';
import { drawingGestures } from './drawing-gestures';
import type { AnnotationOffsets } from './annotation-layout';

interface Ports {
  /** The editor's controls, and the page it is mounted in (a download link belongs to the page). */
  dom: { $(selector: string): HTMLElement; document: { createElement: Document['createElement'] }; host: HTMLElement };
  lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void; cleanup(callback: () => void): void };
  /** The scene the drawings are made from, read when they open. */
  scene(): EditorScene;
  closeMenu(): void;
}

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
export function bindDrawingsViewer({ dom, lifetime, scene, closeMenu }: Ports) {
  const { document } = dom, page = dom.host.ownerDocument, menu = dom.$('#menu'), item = document.createElement('button');
  item.className = 'mi'; item.type = 'button'; item.setAttribute('role', 'menuitem');
  item.innerHTML = ICON + '<span>Technical drawings</span>';
  const help = menu.querySelector('[data-editor-id="help-menu"]');
  if (help) menu.insertBefore(item, help); else menu.append(item);

  const panel = document.createElement('div');
  panel.className = 'drawings'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Technical drawings');
  panel.innerHTML = '<header class="drawings-bar"><div class="drawings-title"><h2>Technical drawings</h2><span class="drawings-count"></span></div>'
    + '<div class="drawings-tools"><div class="drawings-zoom" role="group" aria-label="Zoom"><button type="button" data-zoom="-1" aria-label="Zoom out">−</button>'
    + '<button type="button" data-zoom="1" aria-label="Zoom in">+</button></div><button type="button" class="drawings-pdf">Save as PDF</button></div>'
    + '<button type="button" class="drawings-close" aria-label="Close technical drawings">×</button></header>'
    + '<div class="drawings-sheets" tabindex="0" aria-label="Sheets"></div>';
  dom.$('#app').append(panel);
  const list = panel.querySelector<HTMLElement>('.drawings-sheets')!, count = panel.querySelector<HTMLElement>('.drawings-count')!;
  let scale = 1, current: { sheets: Sheet[]; info: SheetSetInfo } | null = null;

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
  function open() {
    closeMenu();
    const s = scene(), input = { studio: s.studio, pieces: s.wardrobes.map(c => ({ id: c.id, name: c.name,
      x: c.x, y: c.y || 0, z: c.z, angle: c.angle, design: c.state })) };
    const sheets = technicalDrawings(input, { clearanceProfile: 'nkba-single' });
    const clearance = technicalDrawings(input, { preset: 'clearances', clearanceProfile: 'nkba-single' })[0];
    if (clearance) sheets.splice(sheets[1]?.title === 'Upper cabinet plan' ? 2 : 1, 0, { ...clearance, title: 'Clearances plan' });
    const pages = paginateDrawingSheets(sheets);
    const info = { project: project(s), date: new Date().toLocaleDateString(), total: pages.length };
    current = { sheets: pages, info };
    // Each sheet is its own SVG document, as it prints: its hatching and styles resolve inside it, not in the editor.
    list.innerHTML = pages.map(sheet => '<figure class="drawings-sheet"><img alt="' + (sheet.number + ' ' + sheet.title).replace(/"/g, '') + '" src="data:image/svg+xml;charset=utf-8,'
      + encodeURIComponent(sheetSvg(sheet, info)) + '"></figure>').join('');
    const checks = sheets[0]?.issues?.length ?? 0;
    count.textContent = pages.length + (pages.length === 1 ? ' sheet' : ' sheets') + ' · A3 · mm' + (checks ? ' · ' + checks + (checks === 1 ? ' thing' : ' things') + ' to check' : '');
    count.classList.toggle('has-checks', checks > 0);
    panel.hidden = false;
    scale = 1;
    zoomTo(1);
    list.scrollTo(0, 0);
    panel.querySelector<HTMLButtonElement>('.drawings-close')!.focus();
  }
  const close = () => { panel.hidden = true; list.innerHTML = ''; current = null; item.focus(); };
  /** Writes the PDF and hands it over: through the share sheet on a phone (Save to Files, Mail), downloaded elsewhere.
   * The file is made from the sheets, not from the screen, so the zoom or scroll of the viewer never changes it. */
  async function savePdf() {
    if (!current) return;
    const name = fileName(current.info.project), bytes = drawingsPdf(current.sheets, current.info);
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
  lifetime.listen(item, 'click', open);
  lifetime.listen(panel.querySelector('.drawings-close')!, 'click', close);
  lifetime.listen(panel.querySelector('.drawings-pdf')!, 'click', () => { void savePdf(); });
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
  lifetime.cleanup(() => { item.remove(); panel.remove(); });
  return { open, close };
}
