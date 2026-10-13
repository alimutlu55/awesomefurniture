import * as THREE from 'three';
import { cabinetResizeGrip, type CabinetResizeEdge } from '../../domain/geometry/cabinet-resize';
import type { CreateEditorGesturesPorts } from './editor-gestures.ports';

type Ports = Pick<CreateEditorGesturesPorts, 'model' | 'picking' | 'camera' | 'sceneCommands' | 'selectionState' | 'rendering' | 'history' | 'inspector'> & { renderState: { Gr: THREE.Group | null } };
const axis = (edge: CabinetResizeEdge) => edge === 'top' ? 'h' : edge === 'front' || edge === 'back' ? 'd' : 'w';
const sign = (edge: CabinetResizeEdge) => edge === 'left' || edge === 'back' ? -1 : 1;

/** Pointer deltas belong to one face. Collision checks never translate the fixed opposite face. */
export function createWardrobeResize({ model, picking, renderState, camera, sceneCommands, selectionState, rendering, history, inspector }: Ports) {
  let drag: { edge: CabinetResizeEdge; pointer: number; handle: HTMLElement; snapshot: string; size: number;
    x: number; y: number; vector: { x: number; y: number } } | null = null;
  function beginWardrobeResize(e: PointerEvent, edge: CabinetResizeEdge, handle: HTMLElement) {
    const group = renderState.Gr;
    if (e.button !== 0 || !group) return;
    e.preventDefault(); e.stopPropagation();
    camera.camRelease();
    const cabinet = model.activeCabinet(), key = axis(edge), grip = cabinetResizeGrip(cabinet.state, edge), p = new THREE.Vector3(grip.x, grip.y, grip.z);
    const q = p.clone();
    if (key === 'h') q.y += 10;
    else if (key === 'd') q.z += 10 * sign(edge);
    else q.x += 10 * sign(edge);
    const a = picking.screenPoint(group.localToWorld(p)), b = picking.screenPoint(group.localToWorld(q));
    let vector = { x: (b.x - a.x) / 10, y: (b.y - a.y) / 10 };
    // Looking straight at a face collapses its depth axis; vertical dragging still changes depth.
    if (Math.hypot(vector.x, vector.y) < .15) vector = { x: 0, y: -sign(edge) };
    drag = { edge, pointer: e.pointerId, handle, snapshot: model.snapshot(), size: cabinet.state[key], x: e.clientX, y: e.clientY, vector };
    selectionState.editingSize = key;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('resizing');
    rendering.build();
  }
  function moveWardrobeResize(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const { vector, edge } = drag, key = axis(edge);
    const delta = ((e.clientX - drag.x) * vector.x + (e.clientY - drag.y) * vector.y) / (vector.x ** 2 + vector.y ** 2);
    const want = Math.round(drag.size + delta), from = model.activeCabinet().state[key];
    if (want !== from && !sceneCommands.setCabinetSize(key, want, false, edge)) {
      // Keep advancing to contact instead of rejecting the entire pointer movement.
      let lo = 0, hi = 1;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2, value = Math.round(from + (want - from) * mid);
        if (value === model.activeCabinet().state[key] || sceneCommands.setCabinetSize(key, value, false, edge)) lo = mid;
        else hi = mid;
      }
    }
    rendering.build();
  }
  function finishWardrobeResize(cancel = false) {
    if (!drag) return;
    const g = drag;
    drag = null;
    g.handle.classList.remove('resizing');
    if (g.handle.hasPointerCapture(g.pointer)) g.handle.releasePointerCapture(g.pointer);
    selectionState.editingSize = false;
    if (cancel) model.restore(g.snapshot);
    else if (model.snapshot() !== g.snapshot) {
      sceneCommands.followCeilings();
      history.checkpoint(g.snapshot);
    }
    inspector.update(true);
  }
  return { beginWardrobeResize, moveWardrobeResize, finishWardrobeResize };
}
