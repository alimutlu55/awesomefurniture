import { takeMobilePanel } from './mobile-panel-owner.js';
import type { createEditorDom } from './editor-dom.js';
import type { createStudioFields } from './studio-fields';
import type { RoomSelection } from '../viewport/studio-renderer';

/** Ceiling sizes use the wardrobe's existing panel and shared sizing controls. */
export function createStudioResizePanel({ dom, fields, selection, prepare, frame }: {
  dom: ReturnType<typeof createEditorDom>; fields: ReturnType<typeof createStudioFields>;
  selection(): RoomSelection; prepare(): void; frame(): void;
}) {
  const panel = dom.$('#left'), app = dom.$('#app');
  let section: HTMLElement | null = null;
  function sync() {
    if (selection()?.kind === 'ceiling' || panel.dataset.roomResize === undefined) return;
    delete panel.dataset.roomResize; delete panel.dataset.contextSection;
    if (selection()) { app.classList.remove('props-open'); app.classList.add('props-hidden'); }
  }
  function open() {
    if (selection()?.kind !== 'ceiling') return;
    if (!section) {
      section = dom.document.createElement('section'); section.dataset.wardrobeControls = 'resize'; section.dataset.studioResize = '';
      const title = dom.document.createElement('h2'); title.textContent = 'Size'; section.append(title, fields.root);
      dom.$('#left-body').append(section);
    }
    prepare(); takeMobilePanel(dom, panel);
    panel.dataset.roomResize = ''; panel.dataset.contextSection = 'resize'; panel.dataset.sheetPosition = 'compact';
    fields.render();
    panel.scrollTop = 0; app.classList.add('props-open'); app.classList.remove('props-hidden', 'inspecting', 'adding');
    frame();
  }
  return { open, sync };
}
