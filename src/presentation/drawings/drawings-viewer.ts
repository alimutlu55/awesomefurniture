import type { EditorScene } from '../../application/projects/editor-scene';
import type { Sheet } from '../../domain/drawings/drawing';
import { technicalDrawings } from '../../domain/drawings/technical-drawings';
import { furnitureModule } from '../../domain/furniture/furniture';
import { type SheetSetInfo, sheetSvg } from './sheet-marks';

interface Ports {
  /** The editor's controls, and the page it is mounted in (the print frame belongs to the page). */
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

/** Every sheet in one document, one A3 landscape page each, for the browser to print or save as a PDF. */
export function printableDocument(sheets: readonly Sheet[], info: SheetSetInfo) {
  const pages = sheets.map(s => sheetSvg(s, info)).join('');
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + info.project.replace(/</g, '') + ' – technical drawings</title><style>'
    + '@page{size:420mm 297mm;margin:0}html,body{margin:0;padding:0;background:#fff}'
    + 'svg{display:block;width:420mm;height:297mm;break-after:page;page-break-after:always}svg:last-child{break-after:auto;page-break-after:auto}'
    + '</style></head><body>' + pages + '</body></html>';
}

/** "Technical drawings" in the editor menu: the design as a carpenter's drawing set (plan and wall elevations, every
 * dimension in millimetres) on A3 sheets to read on screen, zoomed, and saved as a PDF through the browser's print. */
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
    const s = scene(), sheets = technicalDrawings({ studio: s.studio, pieces: s.wardrobes.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, design: c.state })) });
    const info = { project: project(s), date: new Date().toLocaleDateString(), total: sheets.length };
    current = { sheets, info };
    // Each sheet is its own SVG document, as it prints: its hatching and styles resolve inside it, not in the editor.
    list.innerHTML = sheets.map(sheet => '<figure class="drawings-sheet"><img alt="' + (sheet.number + ' ' + sheet.title).replace(/"/g, '') + '" src="data:image/svg+xml;charset=utf-8,'
      + encodeURIComponent(sheetSvg(sheet, info)) + '"></figure>').join('');
    const checks = sheets[0]?.checks.length ?? 0;
    count.textContent = sheets.length + (sheets.length === 1 ? ' sheet' : ' sheets') + ' · A3 · mm' + (checks ? ' · ' + checks + (checks === 1 ? ' thing' : ' things') + ' to check' : '');
    count.classList.toggle('has-checks', checks > 0);
    panel.hidden = false;
    scale = 1;
    zoomTo(1);
    list.scrollTo(0, 0);
    panel.querySelector<HTMLButtonElement>('.drawings-close')!.focus();
  }
  const close = () => { panel.hidden = true; list.innerHTML = ''; current = null; item.focus(); };
  /** Prints the sheets from a frame of their own, so only the drawings print, each on its own A3 page. */
  function print() {
    if (!current) return;
    const frame = page.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.srcdoc = printableDocument(current.sheets, current.info);
    let done = false;
    const remove = () => { if (!done) { done = true; frame.remove(); } };
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return remove();
      win.addEventListener('afterprint', () => setTimeout(remove, 0));
      win.focus();
      win.print();
      setTimeout(remove, 120000);
    };
    page.body.append(frame);
  }
  lifetime.listen(item, 'click', open);
  lifetime.listen(panel.querySelector('.drawings-close')!, 'click', close);
  lifetime.listen(panel.querySelector('.drawings-pdf')!, 'click', print);
  lifetime.listen(panel.querySelector('.drawings-zoom')!, 'click', e => {
    const dir = Number((e.target as HTMLElement).closest('button')?.dataset.zoom);
    if (dir) step(dir);
  });
  // Two fingers zoom the sheets about the point between them; one finger scrolls them.
  const fingers = new Map<number, { x: number; y: number }>();
  let pinch: { distance: number; scale: number } | null = null;
  const spread = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }; };
  lifetime.listen(list, 'pointerdown', e => {
    const p = e as PointerEvent;
    if (p.pointerType !== 'touch') return;
    fingers.set(p.pointerId, { x: p.clientX, y: p.clientY });
    if (fingers.size === 2) pinch = { distance: spread().d, scale };
  });
  lifetime.listen(list, 'pointermove', e => {
    const p = e as PointerEvent;
    if (!fingers.has(p.pointerId)) return;
    fingers.set(p.pointerId, { x: p.clientX, y: p.clientY });
    if (!pinch || fingers.size !== 2) return;
    const s = spread(), box = list.getBoundingClientRect();
    zoomTo(pinch.scale * s.d / Math.max(1, pinch.distance), { x: s.x - box.left, y: s.y - box.top });
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    lifetime.listen(list, type, e => { fingers.delete((e as PointerEvent).pointerId); if (fingers.size < 2) pinch = null; });
  }
  // Ctrl + wheel (and a trackpad pinch) zooms on a computer.
  lifetime.listen(list, 'wheel', e => {
    const w = e as WheelEvent;
    if (!w.ctrlKey) return;
    w.preventDefault();
    const box = list.getBoundingClientRect();
    zoomTo(scale * Math.exp(-w.deltaY / 200), { x: w.clientX - box.left, y: w.clientY - box.top });
  });
  lifetime.listen(panel, 'keydown', e => { if ((e as KeyboardEvent).key === 'Escape') { e.stopPropagation(); close(); } });
  lifetime.cleanup(() => { item.remove(); panel.remove(); });
  return { open, close };
}
