import { createSurfaceShapeEditor } from './surface-shape-editor';
import { createWardrobeSizeBackend, type WardrobeSizeBackendPorts } from './wardrobe-size-backend';
import type { SurfaceShapeEditorPorts } from './surface-shape-editor.ports';
import { furnitureModule } from '../../domain/furniture/furniture';

export function createWardrobeSizeEditor({ dom, model, sceneCommands, history, listen, callbacks }: Omit<WardrobeSizeBackendPorts, 'rebuild' | 'report'> & {
  dom: ReturnType<typeof import('./editor-dom').createEditorDom>;
  sceneCommands: WardrobeSizeBackendPorts['sceneCommands'] & SurfaceShapeEditorPorts['sceneCommands'];
  listen: SurfaceShapeEditorPorts['listen'];
  callbacks: SurfaceShapeEditorPorts['callbacks'];
}) {
  const backend = createWardrobeSizeBackend({ model, sceneCommands, history, rebuild: callbacks.rebuild, report: callbacks.report });
  const drawing = createSurfaceShapeEditor({ document: dom.document as Document, model, sceneCommands, history, listen, callbacks, backend });
  function render() {
    const panel = dom.$('#left');
    if (panel.dataset.roomResize !== undefined || panel.dataset.contextSection !== 'resize'
      || !dom.$('#app').classList.contains('props-open') || !furnitureModule(model.activeCabinet().state).shaped) return;
    if (!drawing.root.isConnected) dom.$('#wardrobe-size-drawing').append(drawing.root);
    drawing.open({ kind: 'wall', id: 'wardrobe:' + model.activeCabinet().id });
  }
  return { render, view: drawing.view };
}
