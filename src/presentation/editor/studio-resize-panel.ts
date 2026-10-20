import { takeMobilePanel } from './mobile-panel-owner.js';
import type { createEditorDom } from './editor-dom.js';
import type { createStudioFields } from './studio-fields';
import type { RoomSelection } from '../viewport/studio-renderer';

/** All room sizes use the wardrobe's existing panel and shared sizing controls. */
export function createStudioResizePanel({ dom, fields, selection, prepare, frame, paint }: {
  dom: ReturnType<typeof createEditorDom>; fields: ReturnType<typeof createStudioFields>;
  selection(): RoomSelection; prepare(): void; frame(): void;
  paint?: { root: HTMLElement; render(): void };
}) {
  const panel = dom.$('#left'), app = dom.$('#app');
  let section: HTMLElement | null = null;
  let paintSection: HTMLElement | null = null;
  function sync() {
    if (selection() || panel.dataset.roomResize === undefined) return;
    delete panel.dataset.roomResize; delete panel.dataset.contextSection;
    app.classList.remove('props-open'); app.classList.add('props-hidden');
  }
  function open() {
    if (!selection()) return;
    if (!section) {
      section = dom.document.createElement('section'); section.dataset.wardrobeControls = 'resize'; section.dataset.studioResize = '';
      const title = dom.document.createElement('h2'); title.textContent = 'Size'; section.append(title, fields.root);
      dom.$('#left-body').append(section);
    }
    prepare(); takeMobilePanel(dom, panel);
    panel.dataset.roomResize = ''; panel.dataset.contextSection = 'resize'; panel.dataset.sheetPosition = 'compact';
    fields.render();
    panel.scrollTop = 0; app.classList.add('props-open'); app.classList.remove('props-hidden', 'inspecting', 'adding');
  }
  function openPaint() {
    if (selection()?.kind !== 'wall' || !paint) return;
    if (!paintSection) {
      paintSection = dom.document.createElement('section');
      paintSection.dataset.wardrobeControls = 'wall-paint'; paintSection.dataset.studioResize = '';
      const title = dom.document.createElement('h2'); title.textContent = 'Paint / Finish';
      paintSection.append(title, paint.root); dom.$('#left-body').append(paintSection);
    }
    prepare(); takeMobilePanel(dom, panel);
    panel.dataset.roomResize = ''; panel.dataset.contextSection = 'wall-paint'; panel.dataset.sheetPosition = 'compact';
    paint.render(); panel.scrollTop = 0;
    app.classList.add('props-open'); app.classList.remove('props-hidden', 'inspecting', 'adding');
    frame();
  }
  return { open, openPaint, sync };
}
