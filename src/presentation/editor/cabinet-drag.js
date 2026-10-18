import * as THREE from "three";
import { isKitchen } from '../../domain/furniture/furniture';
import { kitchenUnit } from '../../domain/kitchen/kitchen-units';
/** A piece that hangs on a wall (a kitchen wall unit) moves up and down and along its wall, not across the floor. */
const hangs = state => isKitchen(state) && kitchenUnit(state.unit).elevation > 0;
/** @param {Pick<import('./editor-gestures.ports').CreateEditorGesturesPorts, 'dom' | 'camera' | 'inspector' | 'model' | 'picking' | 'interactionState' | 'cameraState' | 'resources' | 'sceneCommands' | 'renderState' | 'history' | 'cabinetGeometry'> & { callbacks: Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement'> & { wallGuide(segment: { a: { x: number; z: number }; b: { x: number; z: number } } | null): void; assist(sides: import('../../domain/studio/scene-gaps').GapSide[] | null): void } }} ports */
export function createCabinetDrag({ dom, camera, inspector, model, picking, interactionState, cameraState, resources, sceneCommands, renderState, history, cabinetGeometry, callbacks }) {
    function beginRotation(e, handle) {
        callbacks.cancelMovement();
        camera.camRelease();
        inspector.hidePop();
        const w = model.activeCabinet(), p = e && picking.groundPoint(e);
        const polar = p ? Math.atan2(p.x - w.x, p.z - w.z) : null;
        // `from`: where the turn started, so a piece slid out from a wall comes back there.
        interactionState.rotationGesture = { id: w.id, original: w.angle, from: { x: w.x, z: w.z }, snapshot: model.snapshot(), handle,
            x: e?.clientX ?? null, polar, spatial: cameraState.el > .15, moved: false };
        handle.classList.add('rotating');
        handle.setAttribute('aria-pressed', 'true');
        resources.cv.style.cursor = 'grabbing';
    }
    function rotateFromPointer(e) {
        const g = interactionState.rotationGesture;
        if (!g) {
            return;
        }
        const w = model.activeCabinet(), p = picking.groundPoint(e);
        if (g.x === null) {
            g.x = e.clientX;
            g.polar = p ? Math.atan2(p.x - w.x, p.z - w.z) : null;
            return;
        }
        let delta = (e.clientX - g.x) * .6;
        if (g.spatial && p && g.polar !== null) {
            const a = Math.atan2(p.x - w.x, p.z - w.z) - g.polar;
            delta = Math.atan2(Math.sin(a), Math.cos(a)) * 180 / Math.PI;
        }
        let angle = g.original + delta;
        if (!e.shiftKey) {
            angle = Math.round(angle / 5) * 5;
            const right = Math.round(angle / 90) * 90;
            if (Math.abs(angle - right) <= 5) {
                angle = right;
            }
        }
        sceneCommands.previewRotation(w.id, ((angle % 360) + 360) % 360, g.from);
        g.moved = g.moved || Math.abs(delta) > 2;
        renderState.Gr.rotation.y = w.angle * Math.PI / 180;
        renderState.Gr.updateMatrixWorld(true);
        g.handle.querySelector('span').textContent = Math.round(w.angle) + '°';
    }
    function finishRotation(cancel = false) {
        const g = interactionState.rotationGesture;
        if (!g) {
            return;
        }
        interactionState.rotationGesture = null;
        const w = model.scene.wardrobes.find(w => w.id === g.id);
        // A turn may have slid the piece out from a wall: undoing it puts it back where it started.
        const start = { angle: g.original, ...g.from };
        if (cancel) {
            sceneCommands.restorePose(g.id, start);
        }
        else if (w.angle !== g.original) {
            if (sceneCommands.settleCabinet(g.id)) sceneCommands.restorePose(g.id, start);
            else history.checkpoint(g.snapshot);
        }
        resources.cv.style.cursor = 'grab';
        inspector.update(true);
    }
    function beginWardrobeDrag(e, axis, handle = null) {
        if (interactionState.rotationGesture) {
            finishRotation();
        }
        callbacks.cancelMovement();
        camera.camRelease();
        const w = model.activeCabinet(), origin = { x: w.x, y: w.y || 0, z: w.z }, anchor = renderState.Gr.localToWorld(new THREE.Vector3(0, 12, model.activeCabinet().state.d / 2 + 28)), projected = {};
        for (const key of ['x', 'y', 'z']) {
            const q = anchor.clone();
            q[key] += 50;
            const a = picking.screenPoint(anchor), b = picking.screenPoint(q);
            projected[key] = { x: (b.x - a.x) / 50, y: (b.y - a.y) / 50 };
        }
        // Along the piece's own width: where a wall unit's left-right drag goes, whichever way its wall faces.
        const turn = w.angle * Math.PI / 180, along = anchor.clone();
        along.x += Math.cos(turn) * 50; along.z -= Math.sin(turn) * 50;
        const a0 = picking.screenPoint(anchor), a1 = picking.screenPoint(along);
        projected.along = { x: (a1.x - a0.x) / 50, y: (a1.y - a0.y) / 50 };
        const planeHeight = axis === 'floor' ? (picking.cast(e, renderState.hits)?.point.y || 0) : 0;
        interactionState.wardrobeGesture = { id: w.id, origin, axis, handle, projected, x: e.clientX, y: e.clientY, planeHeight, ground: picking.groundPoint(e, planeHeight), snapshot: model.snapshot(), moved: false };
        resources.cv.style.cursor = 'grabbing';
        if (handle) {
            handle.classList.add('moving');
        }
    }
    function moveWardrobeFromPointer(e) {
        const g = interactionState.wardrobeGesture;
        if (!g) {
            return;
        }
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (!g.moved && Math.hypot(dx, dy) < 5) {
            return;
        }
        if (!g.moved) {
            inspector.hidePop();
        }
        g.moved = true;
        let delta = {};
        if (g.axis === 'floor' && hangs(model.activeCabinet().state)) {
            // Wall units: the pointer moves them in the plane of their wall: along it and up or down.
            const u = g.projected.along, v = g.projected.y, det = u.x * v.y - u.y * v.x, turn = model.activeCabinet().angle * Math.PI / 180;
            if (Math.abs(det) > .01) {
                const along = (dx * v.y - dy * v.x) / det, up = (u.x * dy - u.y * dx) / det;
                delta = { x: along * Math.cos(turn), y: up, z: -along * Math.sin(turn) };
            }
        }
        else if (g.axis === 'floor') {
            const p = picking.groundPoint(e, g.planeHeight);
            if (cameraState.el > .15 && p && g.ground) {
                delta = { x: p.x - g.ground.x, z: p.z - g.ground.z };
            }
            else {
                const u = g.projected.x, v = g.projected.z, det = u.x * v.y - u.y * v.x;
                if (Math.abs(det) > .01) {
                    delta = { x: (dx * v.y - dy * v.x) / det, z: (u.x * dy - u.y * dx) / det };
                }
                else {
                    delta = { x: dx / Math.max(.15, Math.abs(u.x)), z: -dy / Math.max(.15, Math.abs(v.y)) };
                }
            }
        }
        else {
            const v = g.projected[g.axis], length = v.x * v.x + v.y * v.y;
            delta[g.axis] = length > .005 ? (dx * v.x + dy * v.y) / length : dx * 1.5;
        }
        // Whole centimetres follow the pointer smoothly; Shift moves freely.
        if (!e.shiftKey) {
            for (const k in delta) {
                delta[k] = Math.round(delta[k]);
            }
        }
        sceneCommands.previewTranslation(g.id, cabinetGeometry.cabinetTranslation(g.origin, delta));
        const w = model.activeCabinet();
        // In a room, a wardrobe brought near a wall settles flush and square against it (Shift: free).
        const snap = g.axis === 'floor' && !e.shiftKey ? sceneCommands.wallSnap(w, { x: w.x, z: w.z, angle: w.angle }) : null;
        if (snap) sceneCommands.restorePose(g.id, snap);
        // Lines up with what is near (touching, centred, fronts in line) within about 8 pixels; Shift moves freely.
        if (g.axis !== 'y' && !e.shiftKey) sceneCommands.restorePose(g.id, sceneCommands.alignSnap(w, Math.min(15, 8 / Math.max(.05, Math.hypot(g.projected.x.x, g.projected.x.y))), !snap));
        callbacks.wallGuide(snap ? backEdge(snap, w.state) : null);
        // The gaps it is moved along: to the walls and wardrobes beside it, behind and in front, or the ceiling above.
        callbacks.assist(g.axis === 'x' ? ['left', 'right'] : g.axis === 'z' ? ['back', 'front'] : g.axis === 'y' ? ['top'] : ['left', 'right', 'back', 'front']);
        renderState.Gr.rotation.y = w.angle * Math.PI / 180;
        renderState.Gr.position.set(w.x, w.y, w.z);
        renderState.Gr.children.forEach(o => {
            if (o.userData.floorShadow) {
                o.position.y = .12 - w.y;
            }
        });
        renderState.Gr.updateMatrixWorld(true);
    }
    function finishWardrobeDrag(cancel = false) {
        const g = interactionState.wardrobeGesture;
        if (!g) {
            return;
        }
        interactionState.wardrobeGesture = null;
        callbacks.wallGuide(null);
        callbacks.assist(null);
        const w = model.scene.wardrobes.find(w => w.id === g.id);
        if (cancel) {
            sceneCommands.restorePose(g.id, g.origin);
        }
        else if (w.x !== g.origin.x || (w.y || 0) !== g.origin.y || w.z !== g.origin.z) {
            // Dropped under a staircase or a sloped ceiling, it takes the ceiling's shape; too low there, it goes back.
            if (sceneCommands.settleCabinet(g.id)) sceneCommands.restorePose(g.id, g.origin);
            else history.checkpoint(g.snapshot);
        }
        resources.cv.style.cursor = 'grab';
        inspector.update(true);
    }
    /** The back edge of a wardrobe in a pose, on the floor: where it meets the wall it snapped to. */
    function backEdge(pose, state) {
        const a = pose.angle * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), bx = pose.x - Math.sin(a) * state.d / 2, bz = pose.z - Math.cos(a) * state.d / 2;
        return { a: { x: bx - ux * state.w / 2, z: bz - uz * state.w / 2 }, b: { x: bx + ux * state.w / 2, z: bz + uz * state.w / 2 } };
    }
    return { beginRotation, rotateFromPointer, finishRotation, beginWardrobeDrag, moveWardrobeFromPointer, finishWardrobeDrag };
}
