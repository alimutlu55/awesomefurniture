import * as THREE from 'three';
import { cabinetResizeGrip, type CabinetResizeEdge } from '../../domain/geometry/cabinet-resize';
import type { CreateCabinetRendererPorts } from './cabinet-renderer.ports';

type Ports = Pick<CreateCabinetRendererPorts, 'dom' | 'model' | 'resources' | 'selectionState' | 'interactions'> & { renderState: { Gr: THREE.Group | null } };
/** Face grips reuse the existing resize styling and stay connected throughout pointer capture. */
export function createWardrobeResizeHandles({ dom, model, resources, renderState, selectionState, interactions }: Ports) {
  const handles = new Map<CabinetResizeEdge, HTMLButtonElement>();
  function handle(edge: CabinetResizeEdge) {
    let el = handles.get(edge);
    if (el) return el;
    el = dom.document.createElement('button');
    el.type = 'button';
    el.className = 'item-resize-handle wardrobe-resize-handle';
    el.dataset.edge = edge;
    el.setAttribute('aria-label', 'Resize wardrobe ' + edge);
    el.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4"/></svg>';
    const button = el;
    button.onpointerdown = e => interactions.beginWardrobeResize(e, edge, button);
    button.onpointermove = e => { if (button.hasPointerCapture(e.pointerId)) interactions.moveWardrobeResize(e); };
    button.onpointerup = e => { e.stopPropagation(); interactions.finishWardrobeResize(); };
    button.onpointercancel = e => { e.stopPropagation(); interactions.finishWardrobeResize(true); };
    button.onlostpointercapture = () => interactions.finishWardrobeResize();
    button.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); interactions.finishWardrobeResize(true); } };
    dom.$('#item-resize-handles').appendChild(button);
    handles.set(edge, button);
    return button;
  }
  return function sync() {
    const cabinet = model.activeCabinet(), state = cabinet.state, group = renderState.Gr;
    const visible = !!group && model.scene.wardrobes.length > 0 && selectionState.focusOn && !selectionState.shapeEditing
      && state.item < 0 && !(state.divider >= 0) && (dom.width > 900 || dom.$('#left').dataset.contextSection === 'resize');
    if (!visible || !group) { handles.forEach(el => { el.hidden = true; }); return; }
    const camera = group.worldToLocal(resources.cam.position.clone()), rect = resources.cv.getBoundingClientRect();
    const edges: CabinetResizeEdge[] = ['left', 'right', 'front', 'back', 'top'];
    for (const edge of edges) {
      const grip = cabinetResizeGrip(state, edge), p = new THREE.Vector3(grip.x, grip.y, grip.z), el = handle(edge), q = group.localToWorld(p.clone()).project(resources.cam);
      el.hidden = q.z >= 1 || (edge === 'back' ? camera.z >= 0 : edge === 'front' ? camera.z < 0 : false);
      el.style.transform = `translate(-50%,-50%) translate(${(q.x * .5 + .5) * rect.width}px,${(-q.y * .5 + .5) * rect.height}px)`;
      const svg = el.querySelector('svg')!;
      const end = p.clone();
      if (edge === 'top') end.y += 10;
      else if (edge === 'front' || edge === 'back') end.z += 10;
      else end.x += 10;
      const projected = group.localToWorld(end).project(resources.cam);
      const dx = (projected.x - q.x) * rect.width / 20, dy = -(projected.y - q.y) * rect.height / 20;
      svg.style.transform = `rotate(${Math.hypot(dx, dy) < .15 ? -Math.PI / 2 : Math.atan2(dy, dx)}rad)`;
    }
  };
}
