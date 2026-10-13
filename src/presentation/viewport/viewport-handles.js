import * as THREE from "three";
import { createActionBar } from '../editor/action-bar.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
/** @param {Pick<import('./cabinet-renderer.ports').CreateCabinetRendererPorts, 'dom' | 'model' | 'renderState' | 'interactionState' | 'interactions' | 'shell' | 'inspector' | 'resources' | 'selectionState'> & { getRenderDesign(): import('../../domain/wardrobe/editor-design').EditorDesign & { sel: number; item: number; divider: number; open: boolean; space?: any } } & { callbacks: Pick<ReturnType<typeof import('./cabinet-renderer.js').createCabinetRenderer>, 'dimensionStroke' | 'drawSnapGuides'> } & { geometry: ReturnType<typeof createWardrobeGeometry> }} ports */
export function createViewportHandles({ dom, geometry, callbacks, model, renderState, interactionState, interactions, shell, inspector, resources, selectionState, getRenderDesign }) {
    const { $, document } = dom;
    function addRotationIndicator() {
        const radius = Math.hypot(getRenderDesign().w, getRenderDesign().d) / 2 + 16, points = [];
        for (let i = 0; i <= 96; i++) {
            const a = i / 96 * Math.PI * 2;
            points.push(new THREE.Vector3(Math.sin(a) * radius, .5 - (model.activeCabinet().y || 0), Math.cos(a) * radius));
        }
        const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x8d7d65, transparent: true, opacity: .55 }));
        renderState.Gr.add(ring);
        const handle = document.createElement('button');
        handle.className = 'lbl ground-rotate';
        handle.type = 'button';
        handle.setAttribute('aria-label', 'Rotate ' + model.activeCabinet().name);
        handle.setAttribute('aria-pressed', 'false');
        handle.title = 'Drag to rotate · Click, move, then click to set · Arrow keys rotate';
        handle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/></svg><span></span>';
        $('#labels').appendChild(handle);
        renderState.labs.push({ p: new THREE.Vector3(-radius * .55, .8 - (model.activeCabinet().y || 0), radius * .835), el: handle, owner: renderState.Gr });
        handle.onpointerdown = e => {
            if (e.button !== 0) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            if (interactionState.rotationGesture) {
                interactions.finishRotation();
                return;
            }
            interactions.beginRotation(e, handle);
            handle.setPointerCapture(e.pointerId);
        };
        handle.onpointermove = e => {
            if (interactionState.rotationGesture?.handle === handle && handle.hasPointerCapture(e.pointerId)) {
                interactions.rotateFromPointer(e);
            }
        };
        handle.onpointerup = e => {
            if (!interactionState.rotationGesture || interactionState.rotationGesture.handle !== handle) {
                return;
            }
            if (handle.hasPointerCapture(e.pointerId)) {
                handle.releasePointerCapture(e.pointerId);
            }
            if (interactionState.rotationGesture.moved) {
                interactions.finishRotation();
            }
            else {
                shell.toast('Move to rotate · Click to set · Esc to cancel');
            }
        };
        handle.onpointercancel = () => interactions.finishRotation(true);
        handle.onclick = e => {
            if (e.detail === 0) {
                if (interactionState.rotationGesture) {
                    interactions.finishRotation();
                }
                else {
                    interactions.beginRotation(null, handle);
                }
            }
        };
        handle.onkeydown = e => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                inspector.setCabinetPose('angle', model.activeCabinet().angle + (e.key === 'ArrowLeft' ? -15 : 15));
            }
        };
    }
    function addWardrobeActions() {
        if (dom.width <= 900) {
            const actions = createActionBar(document, 'Wardrobe actions', [
                { key: 'dup', title: 'Duplicate wardrobe' },
                { key: 'del', title: 'Remove wardrobe' }
            ]);
            actions.classList.add('lbl', 'wardrobe-actions');
            for (const [key, action] of [['dup', 'duplicate'], ['del', 'remove']]) {
                const button = /** @type {HTMLButtonElement} */ (actions.querySelector('[data-ib="' + key + '"]'));
                button.dataset.wardrobeAction = action;
                button.onpointerdown = e => e.stopPropagation();
                button.onclick = e => {
                    e.stopPropagation();
                    if (action === 'duplicate') inspector.addCabinet(true);
                    else $('#remove-wardrobe').click();
                };
            }
            $('#labels').appendChild(actions);
            renderState.labs.push({ p: new THREE.Vector3(0, getRenderDesign().h / 2, getRenderDesign().d / 2 + 4), el: actions, owner: renderState.Gr });
        }
    }
    function updateMoveIcons() {
        if (!renderState.moveIcons.length || !renderState.Gr) {
            return;
        }
        resources.cam.updateMatrixWorld();
        const W = resources.cv.clientWidth, H = resources.cv.clientHeight, a = renderState.Gr.localToWorld(new THREE.Vector3(0, 12, getRenderDesign().d / 2 + 28)).project(resources.cam);
        for (const m of renderState.moveIcons) {
            const b = renderState.Gr.localToWorld(new THREE.Vector3(0, 12, getRenderDesign().d / 2 + 28)).add(m.world.clone().multiplyScalar(50)).project(resources.cam), dx = (b.x - a.x) * W / 2, dy = -(b.y - a.y) * H / 2;
            if (Math.hypot(dx, dy) < .5) {
                continue;
            }
            m.span.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
        }
    }
    function addWardrobeMoveHandles() {
        renderState.moveIcons = [];
        if (dom.width <= 900) return;
        const anchor = new THREE.Vector3(0, 12, getRenderDesign().d / 2 + 28), inverse = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -model.activeCabinet().angle * Math.PI / 180);
        /** @type {Array<[string,string,string,number]>} */ const axes = [['x', '↔', 'left or right', 48], ['y', '↕', 'up or down', 68], ['z', '↗', 'forward or back', 48]];
        for (const [axis, icon, name, length] of axes) {
            const direction = new THREE.Vector3();
            direction[axis] = 1;
            direction.applyQuaternion(inverse);
            const tip = anchor.clone().addScaledVector(direction, length), side = direction.clone().cross(new THREE.Vector3(0, 1, 0));
            if (side.lengthSq() < .01) {
                side.set(1, 0, 0).applyQuaternion(inverse);
            }
            side.normalize();
            const head = tip.clone().addScaledVector(direction, -5);
            callbacks.dimensionStroke([anchor, tip, tip, head.clone().addScaledVector(side, 2), tip, head.clone().addScaledVector(side, -2)]);
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'lbl wardrobe-move';
            handle.dataset.moveAxis = axis;
            const span = document.createElement('span');
            span.className = 'mv-ic';
            span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4"/></svg>';
            handle.appendChild(span);
            renderState.moveIcons.push({ span, world: new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0) });
            handle.setAttribute('aria-label', 'Move ' + model.activeCabinet().name + ' ' + name);
            handle.title = 'Drag ' + name + ' · Hold Shift for precise movement';
            $('#labels').appendChild(handle);
            renderState.labs.push({ p: anchor.clone().addScaledVector(direction, length + 8), el: handle, owner: renderState.Gr });
            handle.onpointerdown = e => {
                if (e.button !== 0) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                interactions.beginWardrobeDrag(e, axis, handle);
                handle.setPointerCapture(e.pointerId);
            };
            handle.onpointermove = e => {
                if (interactionState.wardrobeGesture?.handle === handle) {
                    interactions.moveWardrobeFromPointer(e);
                }
            };
            handle.onpointerup = e => {
                if (interactionState.wardrobeGesture?.handle === handle) {
                    interactions.finishWardrobeDrag();
                }
            };
            handle.onpointercancel = () => interactions.finishWardrobeDrag(true);
            handle.onkeydown = e => {
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    e.preventDefault();
                    const positive = e.key === 'ArrowRight' || e.key === 'ArrowUp';
                    inspector.setCabinetPose(axis, (model.activeCabinet()[axis] || 0) + (positive ? 5 : -5));
                }
            };
        }
    }
    function updateItemResizeHandles() {
        callbacks.drawSnapGuides();
        if (!$('#item-resize-handles').children.length) {
            return;
        }
        const g = selectionState.focusOn && getRenderDesign().item >= 0 && !interactionState.drag?.started && !interactionState.moveMode && !(getRenderDesign().doors !== 'none' && !getRenderDesign().open) ? geometry.itemGeom(getRenderDesign().sel, getRenderDesign().item) : null;
        const front = g && renderState.Gr.worldToLocal(resources.cam.position.clone()).z > getRenderDesign().d / 2;
        renderState.itemEdgeHandles.forEach(handle => {
            handle.hidden = !front;
            if (!front) {
                return;
            }
            const edge = handle.dataset.edge, x = edge === 'left' ? g.x0 : edge === 'right' ? g.x1 : (g.x0 + g.x1) / 2, y = edge === 'top' ? g.y1 : (g.y0 + g.y1) / 2, q = renderState.Gr.localToWorld(new THREE.Vector3(x - getRenderDesign().w / 2, y, getRenderDesign().d / 2 + 1)).project(resources.cam), r = resources.cv.getBoundingClientRect();
            handle.hidden = q.z >= 1;
            handle.style.transform = `translate(-50%,-50%) translate(${(q.x * .5 + .5) * r.width}px,${(-q.y * .5 + .5) * r.height}px)`;
        });
    }
    return { addRotationIndicator, addWardrobeActions, updateMoveIcons, addWardrobeMoveHandles, updateItemResizeHandles };
}
