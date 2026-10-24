import { takeMobilePanel } from './mobile-panel-owner.js';
import type { createEditorDom } from './editor-dom.js';
import type { createStudioFields } from './studio-fields';
import type { RoomSelection } from '../viewport/studio-renderer';

/** All room sizes use the wardrobe's existing panel and shared sizing controls. */
export function createStudioResizePanel({ dom, fields, selection, prepare, frame, paint, shape, fixture }: {
  dom: ReturnType<typeof createEditorDom>; fields: ReturnType<typeof createStudioFields>;
  selection(): RoomSelection; prepare(): void; frame(): void;
  paint?: { root: HTMLElement; render(): void };
  /** The Shape editor of a wall or ceiling shape. */
  shape?: { root: HTMLElement; render(): void };
  /** A fixture's Type and Finish choices. */
  fixture?: { root: HTMLElement; show(view: 'fixture-type' | 'fixture-finish'): void };
}) {
  const panel = dom.$('#left'), app = dom.$('#app');
  let section: HTMLElement | null = null;
  let paintSection: HTMLElement | null = null;
  let shapeSection: HTMLElement | null = null;
  let fixtureSection: HTMLElement | null = null;
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
  /** Opens the Shape editor in the same panel: beside the room on a desktop, a sheet on a phone. */
  /** `fresh` starts the panel at its top; moving from one shape to the next keeps where it was scrolled. */
  function openShape(title: string, fresh = true) {
    if (!selection() || !shape) return;
    if (!shapeSection) {
      shapeSection = dom.document.createElement('section');
      shapeSection.dataset.wardrobeControls = 'surface-shape'; shapeSection.dataset.studioResize = '';
      shapeSection.append(dom.document.createElement('h2'), shape.root); dom.$('#left-body').append(shapeSection);
    }
    for (const heading of [shapeSection.querySelector('h2'), panel.querySelector('#left-title, [data-editor-id="left-title"]')]) if (heading) heading.textContent = title;
    if (panel.dataset.contextSection !== 'surface-shape') { prepare(); takeMobilePanel(dom, panel); }
    panel.dataset.roomResize = ''; panel.dataset.contextSection = 'surface-shape'; panel.dataset.sheetPosition = 'compact';
    app.classList.add('props-open'); app.classList.remove('props-hidden', 'inspecting', 'adding');
    if (fresh) panel.scrollTop = 0;
    shape.render();
  }
  /** A fixture's Type or Finish, in the same panel as its Size: beside the room on a desktop, a sheet on a phone. */
  function openFixture(view: 'fixture-type' | 'fixture-finish') {
    if (selection()?.kind !== 'fixture' || !fixture) return;
    if (!fixtureSection) {
      fixtureSection = dom.document.createElement('section');
      fixtureSection.dataset.wardrobeControls = 'fixture'; fixtureSection.dataset.studioResize = '';
      fixtureSection.append(dom.document.createElement('h2'), fixture.root); dom.$('#left-body').append(fixtureSection);
    }
    fixtureSection.querySelector('h2')!.textContent = view === 'fixture-type' ? 'Type' : 'Finish';
    if (showing('fixture') && fixtureSection.dataset.view === view) { close(); return; }
    fixtureSection.dataset.view = view;
    if (panel.dataset.contextSection !== 'fixture') { prepare(); takeMobilePanel(dom, panel); }
    panel.dataset.roomResize = ''; panel.dataset.contextSection = 'fixture'; panel.dataset.sheetPosition = 'compact';
    fixture.show(view); panel.scrollTop = 0;
    app.classList.add('props-open'); app.classList.remove('props-hidden', 'inspecting', 'adding');
  }
  function close() {
    delete panel.dataset.roomResize; delete panel.dataset.contextSection;
    app.classList.remove('props-open'); app.classList.add('props-hidden');
  }
  const showing = (section: string) => panel.dataset.roomResize !== undefined && panel.dataset.contextSection === section && app.classList.contains('props-open');
  return { open, openPaint, openShape, openFixture, showing, sync, close };
}
