import { createSurfaceShapeEditor } from './surface-shape-editor';
import { createWardrobeSizeBackend, type WardrobeSizeBackendPorts } from './wardrobe-size-backend';
import type { SurfaceShapeEditorPorts } from './surface-shape-editor.ports';
import { furnitureModule } from '../../domain/furniture/furniture';
import type { createSceneCommands } from '../../application/commands/scene-commands';
import { measureNumber, unitSuffix } from './editor-format.js';

export function createWardrobeSizeEditor({ dom, model, sceneCommands, history, listen, callbacks }: Omit<WardrobeSizeBackendPorts, 'rebuild' | 'report'> & {
  dom: ReturnType<typeof import('./editor-dom').createEditorDom>;
  sceneCommands: WardrobeSizeBackendPorts['sceneCommands'] & SurfaceShapeEditorPorts['sceneCommands']
    & Pick<ReturnType<typeof createSceneCommands>, 'fillableSpace' | 'fillSpace'>;
  listen: SurfaceShapeEditorPorts['listen'];
  callbacks: SurfaceShapeEditorPorts['callbacks'];
}) {
  const backend = createWardrobeSizeBackend({ model, sceneCommands, history, rebuild: callbacks.rebuild, report: callbacks.report });
  const drawing = createSurfaceShapeEditor({ document: dom.document as Document, model, sceneCommands, history, listen, callbacks, backend });
  // A piece between two walls or neighbours grows to fill the stretch in one tap (fill-commands.ts), as a kitchen unit does
  // from its sliders: the same quiet button, under the drawing.
  const fill = dom.document.createElement('button');
  fill.type = 'button'; fill.className = 'fill-gap'; fill.hidden = true;
  listen(fill, 'click', () => { if (sceneCommands.fillSpace()) callbacks.refresh(); });
  function render() {
    const panel = dom.$('#left');
    if (panel.dataset.roomResize !== undefined || panel.dataset.contextSection !== 'resize'
      || !dom.$('#app').classList.contains('props-open') || !furnitureModule(model.activeCabinet().state).shaped) return;
    if (!drawing.root.isConnected) dom.$('#wardrobe-size-drawing').append(drawing.root, fill);
    drawing.open({ kind: 'wall', id: 'wardrobe:' + model.activeCabinet().id });
    const room = sceneCommands.fillableSpace();
    fill.hidden = room < .05;
    if (!fill.hidden) fill.textContent = 'Fill the ' + measureNumber(room) + unitSuffix() + ' gap beside it';
  }
  return { render, view: drawing.view };
}
