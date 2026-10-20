import type { EditorScene } from '../../application/projects/editor-scene';
import type { DrawingIssue, P, Sheet } from '../../domain/drawings/drawing';
import type { DrawingInput } from '../../domain/drawings/room-pieces';
import { technicalDrawings } from '../../domain/drawings/technical-drawings';
import { DRAWING_PRESETS, type DrawingPreset, type ClearanceProfile } from '../../domain/drawings/view-policy';
import { furnitureModule } from '../../domain/furniture/furniture';
import { type SheetSetInfo, sheetMarks, sheetPresentation } from './sheet-marks';
import { marksToPdf } from './pdf-writer';
import { marksToSvg } from './paper-marks';
import { PAPER, layoutSheet } from './sheet-layout';
import { paginateDrawingSheets } from './table-marks';
import { type Anchor, type AnnotationOffsets } from './annotation-layout';
import { annotationStore } from './drawing-preferences';
import { viewerMarkup } from './drawing-viewer-markup';
import { drawingGestures } from './drawing-gestures';

interface Ports {
  dom: { $(selector: string): HTMLElement; document: { createElement: Document['createElement'] }; host: HTMLElement };
  lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void; cleanup(callback: () => void): void };
  scene(): EditorScene; closeMenu(): void;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const projectName = (scene: EditorScene) => ([...new Set(scene.wardrobes.map(c => furnitureModule(c.state).label))].join(' and ') || 'Room') + ' design';
export function drawingsPdf(sheets: readonly Sheet[], info: SheetSetInfo, offsets: AnnotationOffsets = {}) {
  const pages = paginateDrawingSheets(sheets), set = { ...info, total: pages.length };
  return marksToPdf(pages.map(s => sheetMarks(s, set, offsets)), { w: PAPER.w, h: PAPER.h }, info.project + ' - technical drawings');
}
/** A purpose-based, single-page document viewer. Drawing and export share the same marks and label overrides. */
export function bindDrawingsViewer({ dom, lifetime, scene, closeMenu }: Ports) {
  const doc = dom.host.ownerDocument, win = doc.defaultView, menu = dom.$('#menu'), item = doc.createElement('button');
  item.type = 'button'; item.className = 'mi'; item.setAttribute('role', 'menuitem'); item.textContent = 'Technical drawings'; menu.append(item);
  const panel = doc.createElement('div'); panel.className = 'drawings'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Technical drawings');
  panel.innerHTML = viewerMarkup(); dom.$('#app').append(panel);
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => panel.querySelector<T>(s)!;
  const viewport = $('.drawings-sheets'), figure = $('.drawings-sheet'), inspector = $('.drawing-inspector'), index = $('.drawing-index');
  let preset: DrawingPreset = 'layout', profile: ClearanceProfile = 'nkba-single', input: DrawingInput = { pieces: [] }, pages: Sheet[] = [], active = 0;
  let info: SheetSetInfo = { project: '', date: '', total: 0 }, zoom = 1, fit: 'page' | 'drawing' = 'drawing', selected = '', editingLabel = false;
  let store: ReturnType<typeof annotationStore> | undefined, anchors: Anchor[] = [], warnings: string[] = [], focusedIssue: DrawingIssue | undefined;
  let crop = { x: 0, y: 0, w: PAPER.w as number, h: PAPER.h as number }, unitScale = 1;
  const history: { preset: DrawingPreset; title: string }[] = [];
  const sheet = () => pages[active]!;
  const status = (message: string) => { $('.drawing-status').textContent = message; };
  function refreshPages(title = '') {
    const all = paginateDrawingSheets(technicalDrawings(input, { preset, clearanceProfile: profile }));
    const detail = (s: Sheet) => /^\w+\d+  |^Construction details|^Cutting list|^Hardware list/.test(s.title);
    pages = all.filter(s => preset === 'details' ? detail(s) || !!s.table : !detail(s));
    active = Math.max(0, pages.findIndex(p => p.title === title)); info = { ...info, total: pages.length };
    renderIndex(); render();
  }
  function pageSvg(s: Sheet) { return marksToSvg(sheetMarks(s, info, store?.offsets), PAPER, String(s.number), s.title); }
  function renderIndex() {
    const search = $<HTMLInputElement>('[aria-label="Search sheets"]').value.toLowerCase();
    $('.drawing-index-list').innerHTML = pages.map((s, i) => ({ s, i })).filter(({ s }) => (s.title + ' ' + s.pieces.map(p => p.mark).join(' ')).toLowerCase().includes(search))
      .map(({ s, i }) => '<button type="button" data-sheet="' + i + '" aria-current="' + (i === active ? 'page' : 'false') + '">'
        + '<img alt="" loading="lazy" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pageSvg(s)) + '"><span>' + esc(s.title) + '</span></button>').join('');
  }
  function size() {
    const available = { w: Math.max(160, viewport.clientWidth - 24), h: Math.max(120, viewport.clientHeight - 24) };
    unitScale = Math.min(available.w / crop.w, available.h / crop.h);
    figure.style.width = crop.w * unitScale * zoom + 'px'; figure.style.height = crop.h * unitScale * zoom + 'px';
    $<HTMLButtonElement>('[data-zoom="-1"]').disabled = zoom <= .5;
    $<HTMLButtonElement>('[data-zoom="1"]').disabled = zoom >= 8;
  }
  function zoomTo(value: number, focus = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }) {
    const before = zoom, x = viewport.scrollLeft + focus.x, y = viewport.scrollTop + focus.y;
    zoom = Math.max(.5, Math.min(8, value)); size();
    viewport.scrollLeft = x * zoom / before - focus.x; viewport.scrollTop = y * zoom / before - focus.y;
  }
  function render() {
    if (!pages.length) return;
    const s = sheet(), result = sheetPresentation(s, info, store?.offsets); anchors = result.anchors; warnings = result.warnings;
    const bounds = layoutSheet(s).placed.map(p => p.box), boxes = [...bounds, ...anchors.map(a => a.box)];
    crop = fit === 'drawing' && boxes.length ? { x: Math.max(0, Math.min(...boxes.map(b => b.x0)) - 8), y: Math.max(0, Math.min(...boxes.map(b => b.y0)) - 8),
      w: 0, h: 0 } : { x: 0, y: 0, w: PAPER.w, h: PAPER.h };
    if (!crop.w) { crop.w = Math.min(PAPER.w, Math.max(...boxes.map(b => b.x1)) + 8) - crop.x; crop.h = Math.min(PAPER.h, Math.max(...boxes.map(b => b.y1)) + 8) - crop.y; }
    const svg = marksToSvg(result.marks, PAPER, 'active-drawing', s.title)
      .replace('viewBox="0 0 420 297"', `viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}"`);
    figure.innerHTML = '<img alt="' + esc(s.title) + '" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '">';
    for (const a of anchors.filter(a => a.key.includes('/tag:'))) {
      const mark = a.key.split('/tag:')[1]!, button = doc.createElement('button'); button.type = 'button';
      button.className = 'drawing-hit' + (mark === selected ? ' selected' : ''); button.dataset.tag = mark; button.dataset.anchor = a.key;
      button.setAttribute('aria-label', 'Cabinet ' + mark); button.style.left = (a.at.x - crop.x) / crop.w * 100 + '%';
      button.style.top = (a.at.y - crop.y) / crop.h * 100 + '%'; figure.append(button);
    }
    if (focusedIssue?.at && !s.table && s.title === 'Plan') {
      const paper = layoutSheet(s).placed[0]?.paper, at = paper?.(focusedIssue.at);
      if (at) { const highlight = doc.createElement('span'); highlight.className = 'drawing-location';
        highlight.style.left = (at.x - crop.x) / crop.w * 100 + '%'; highlight.style.top = (at.y - crop.y) / crop.h * 100 + '%'; figure.append(highlight); }
    }
    $('.drawing-current').textContent = (active + 1) + ' / ' + pages.length + ' · ' + s.title;
    $('.drawings-count').textContent = pages.length + ' sheets · A3 · mm';
    $('.drawing-issues-button').textContent = 'Checks (' + ((s.issues?.length ?? 0) + warnings.length) + ')';
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-preset]')) button.setAttribute('aria-pressed', String(button.dataset.preset === preset));
    $('.drawing-rule').hidden = preset !== 'clearances'; $<HTMLSelectElement>('.drawing-rule select').value = profile;
    panel.classList.toggle('drawing-label-edit', editingLabel); size();
  }
  function navigate(next: number, remember = true) {
    if (remember && pages.length) history.push({ preset, title: sheet().title });
    active = Math.max(0, Math.min(pages.length - 1, next)); selected = ''; focusedIssue = undefined; editingLabel = false;
    zoom = 1; render(); renderIndex(); viewport.scrollTo(0, 0);
  }
  function showPiece(mark: string) {
    selected = mark;
    const piece = pages.flatMap(s => s.pieces).find(p => p.mark === mark);
    if (!piece) return;
    inspector.hidden = false;
    inspector.innerHTML = '<button type="button" data-action="close-details" aria-label="Close drawing details">×</button><h3>' + esc(piece.mark + ' · ' + piece.name) + '</h3>'
      + '<p>' + esc(piece.size) + ' mm</p><p>' + esc(piece.where) + '</p><button type="button" data-detail="' + esc(mark) + '">Open cabinet details</button>'
      + '<h4>Label position</h4><p>Saved for this drawing snapshot. Arrow keys move a selected label when Move label is enabled.</p>'
      + '<button type="button" data-action="edit-label" aria-pressed="' + editingLabel + '">Move label</button><div class="drawing-nudges">'
      + '<button type="button" data-nudge="0,-2" aria-label="Move label up">↑</button><button type="button" data-nudge="-2,0" aria-label="Move label left">←</button>'
      + '<button type="button" data-nudge="2,0" aria-label="Move label right">→</button><button type="button" data-nudge="0,2" aria-label="Move label down">↓</button></div>'
      + '<button type="button" data-action="reset-label">Reset label</button>';
    render();
  }
  function moveLabel(delta: P) {
    const a = anchors.find(a => a.key.endsWith('/tag:' + selected));
    if (!a || !store) { status('Open the plan containing this cabinet to position its label.'); return; }
    store.offsets[a.key] = { x: a.offset.x + delta.x, y: a.offset.y + delta.y };
    render();
    const actual = anchors.find(anchor => anchor.key === a.key);
    const adjusted = actual && (Math.abs(actual.offset.x - store.offsets[a.key]!.x) > .1 || Math.abs(actual.offset.y - store.offsets[a.key]!.y) > .1);
    if (actual) store.offsets[a.key] = actual.offset;
    renderIndex();
    status(adjusted ? 'Position would obscure the drawing; nearest clear label position kept.' : store.save() ? 'Label position saved.' : 'Label position kept for this session; browser storage is unavailable.');
    if (adjusted) store.save();
  }
  function showIssues() {
    inspector.hidden = false; const issues = sheet().issues ?? [];
    inspector.innerHTML = '<button type="button" data-action="close-details" aria-label="Close drawing details">×</button><h3>Drawing checks</h3>'
      + issues.map((i, n) => '<button type="button" class="drawing-issue" data-issue="' + n + '"><strong>' + esc(i.severity + ' · ' + i.kind) + '</strong><span>' + esc(i.message)
        + '</span><small>' + esc(i.rule ?? '') + (i.required !== undefined ? ' · measured ' + i.measured + ' mm / reference ' + i.required + ' mm' : '') + '</small></button>').join('')
      + warnings.map(w => '<p class="drawing-warning">' + esc(w) + '</p>').join('') + (!issues.length && !warnings.length ? '<p>No checks in this drawing set.</p>' : '');
    size();
  }
  function showSchedule() {
    inspector.hidden = false; const rows = new Map(pages.flatMap(s => s.pieces).map(p => [p.mark, p]));
    inspector.innerHTML = '<button type="button" data-action="close-details" aria-label="Close drawing details">×</button><h3>Cabinets</h3>'
      + [...rows.values()].map(p => '<button type="button" class="drawing-cabinet" data-piece="' + esc(p.mark) + '"><strong>' + esc(p.mark + ' · ' + p.name)
        + '</strong><span>' + esc(p.size) + ' mm</span><small>' + esc(p.where) + '</small></button>').join(''); size();
  }
  function exportPreview() {
    $('.drawing-export').hidden = false;
    $('.drawing-export-purpose').textContent = DRAWING_PRESETS.find(p => p.key === preset)!.label + ' · ' + (preset === 'clearances' ? profile : 'drawing set');
    $('.drawing-export-summary').textContent = $<HTMLSelectElement>('[aria-label="Export pages"]').value === 'sheet' ? sheet().title : pages.length + ' sheets: ' + pages.map(s => s.title).join(', ');
    $('.drawing-export-image').innerHTML = '<img alt="Export preview" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pageSvg(sheet())) + '">'; $('[data-action="download"]').focus();
  }
  async function download() {
    const exportPages = $<HTMLSelectElement>('[aria-label="Export pages"]').value === 'sheet' ? [sheet()] : pages;
    const bytes = drawingsPdf(exportPages, info, store?.offsets), name = info.project.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + preset + '.pdf';
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }), file = new File([blob], name, { type: 'application/pdf' });
    if (win?.navigator.canShare?.({ files: [file] }) && win.matchMedia('(pointer: coarse)').matches) {
      try { await win.navigator.share({ files: [file], title: name }); $('.drawing-export').hidden = true; return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob), link = doc.createElement('a'); link.href = url; link.download = name; doc.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); $('.drawing-export').hidden = true;
  }
  function open() {
    closeMenu(); const s = scene();
    input = { studio: s.studio, pieces: s.wardrobes.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, design: c.state })) };
    let storage: Storage | undefined; try { storage = win?.localStorage; } catch { /* Private browsing. */ }
    store = annotationStore(input, storage); info = { project: projectName(s), date: new Date().toLocaleDateString(), total: 0 };
    preset = 'layout'; profile = 'nkba-single'; active = 0; zoom = 1; history.length = 0; selected = ''; focusedIssue = undefined;
    inspector.hidden = true; index.hidden = true; $('.drawing-export').hidden = true; panel.hidden = false; fit = 'drawing'; refreshPages(); $('.drawings-close').focus();
  }
  const close = () => { panel.hidden = true; figure.innerHTML = ''; item.focus(); };
  lifetime.listen(item, 'click', open);
  lifetime.listen(panel, 'click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
    if (button.classList.contains('drawings-close')) { close(); return; }
    if (button.classList.contains('drawings-pdf')) { exportPreview(); return; }
    if (button.dataset.preset) { history.push({ preset, title: sheet().title }); preset = button.dataset.preset as DrawingPreset; zoom = 1; refreshPages(); return; }
    if (button.dataset.fit) { fit = button.dataset.fit as typeof fit; zoom = 1; render(); viewport.scrollTo(0, 0); return; }
    if (button.dataset.zoom) { zoomTo(zoom * (Number(button.dataset.zoom) > 0 ? 1.6 : 1 / 1.6)); return; }
    if (button.dataset.sheet) { navigate(Number(button.dataset.sheet)); index.hidden = true; return; }
    if (button.dataset.tag || button.dataset.piece) { showPiece(button.dataset.tag ?? button.dataset.piece!); return; }
    if (button.dataset.detail) { preset = 'details'; refreshPages(); navigate(pages.findIndex(s => s.title.startsWith(button.dataset.detail! + '  '))); return; }
    if (button.dataset.nudge) { const [x, y] = button.dataset.nudge.split(',').map(Number); moveLabel({ x: x!, y: y! }); return; }
    if (button.dataset.issue !== undefined) {
      const issue = sheet().issues?.[Number(button.dataset.issue)]; if (!issue) return;
      preset = 'clearances'; fit = 'drawing'; zoom = 2; focusedIssue = issue; refreshPages('Plan');
      const target = figure.querySelector('.drawing-location')?.getBoundingClientRect(), frame = viewport.getBoundingClientRect();
      if (target) viewport.scrollBy(target.x + target.width / 2 - frame.x - frame.width / 2, target.y + target.height / 2 - frame.y - frame.height / 2);
      status(issue.message); return;
    }
    switch (button.dataset.action) {
      case 'sheets': index.hidden = !index.hidden; button.setAttribute('aria-expanded', String(!index.hidden)); size(); break;
      case 'issues': showIssues(); break;
      case 'schedule': showSchedule(); break;
      case 'close-details': inspector.hidden = true; size(); break;
      case 'previous': navigate(active - 1); break;
      case 'next': navigate(active + 1); break;
      case 'back-view': { const previous = history.pop(); if (previous) { preset = previous.preset; refreshPages(previous.title); } break; }
      case 'edit-label': editingLabel = !editingLabel; showPiece(selected); break;
      case 'reset-label': { const a = anchors.find(a => a.key.endsWith('/tag:' + selected)); if (a && store) { delete store.offsets[a.key]; store.save(); render(); renderIndex(); } break; }
      case 'download': void download(); break;
      case 'cancel-export': $('.drawing-export').hidden = true; $('.drawings-pdf').focus(); break;
    }
  });
  lifetime.listen($('[aria-label="Search sheets"]'), 'input', renderIndex);
  lifetime.listen($('.drawing-rule select'), 'change', () => { profile = $<HTMLSelectElement>('.drawing-rule select').value as ClearanceProfile; refreshPages(sheet().title); showIssues(); });
  lifetime.listen($('[aria-label="Export pages"]'), 'change', exportPreview);
  lifetime.listen(panel, 'keydown', event => {
    const e = event as KeyboardEvent;
    if (e.key === 'Tab') {
      const scope = !$('.drawing-export').hidden ? $('.drawing-export') : panel;
      const focusable = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')].filter(el => el.getClientRects().length);
      const next = e.shiftKey ? focusable.at(-1) : focusable[0], edge = e.shiftKey ? focusable[0] : focusable.at(-1);
      if (doc.activeElement === edge || !scope.contains(doc.activeElement)) { e.preventDefault(); next?.focus(); }
    }
    if (e.key === 'Escape') { e.stopPropagation(); if (!$('.drawing-export').hidden) $('.drawing-export').hidden = true; else close(); }
    const delta = ({ ArrowLeft: { x: -2, y: 0 }, ArrowRight: { x: 2, y: 0 }, ArrowUp: { x: 0, y: -2 }, ArrowDown: { x: 0, y: 2 } } as Record<string, P>)[e.key];
    if (editingLabel && selected && delta && !['INPUT', 'SELECT'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); moveLabel(delta); }
  });
  let drag: { id: number; x: number; y: number; key: string; offset: P } | undefined;
  lifetime.listen(figure, 'pointerdown', event => {
    const e = event as PointerEvent, hit = (e.target as HTMLElement).closest<HTMLElement>('[data-anchor]');
    if (!editingLabel || !hit) return; const a = anchors.find(a => a.key === hit.dataset.anchor); if (!a) return;
    e.preventDefault(); selected = hit.dataset.tag!; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, key: a.key, offset: a.offset }; figure.setPointerCapture(e.pointerId);
  });
  lifetime.listen(figure, 'pointermove', event => {
    const e = event as PointerEvent; if (!drag || e.pointerId !== drag.id || !store) return;
    store.offsets[drag.key] = { x: drag.offset.x + (e.clientX - drag.x) / (unitScale * zoom), y: drag.offset.y + (e.clientY - drag.y) / (unitScale * zoom) }; render();
  });
  for (const type of ['pointerup', 'pointercancel']) lifetime.listen(figure, type, () => {
    if (!drag || !store) return;
    const actual = anchors.find(a => a.key === drag!.key);
    store.offsets[drag.key] = type === 'pointercancel' ? drag.offset : actual?.offset ?? drag.offset;
    store.save(); drag = undefined; render(); renderIndex();
  });
  drawingGestures(viewport, lifetime, () => zoom, zoomTo);
  const observer = new ResizeObserver(() => { if (!panel.hidden) size(); }); observer.observe(viewport);
  lifetime.cleanup(() => { observer.disconnect(); item.remove(); panel.remove(); });
  return { open, close };
}
