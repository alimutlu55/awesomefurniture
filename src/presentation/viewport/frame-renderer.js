/** @param {Pick<import('./cabinet-renderer.ports').CreateCabinetRendererPorts, 'dom' | 'lifetime' | 'renderState' | 'camera' | 'resources' | 'cameraState' | 'interactionState' | 'picking' | 'interactions' | 'shellState'> & { callbacks: Pick<ReturnType<typeof import('./cabinet-renderer.js').createCabinetRenderer>, 'positionLabels'> } & { clock?: Pick<Performance, 'now'> }} ports */
export function createFrameRenderer({ dom, clock = performance, lifetime, renderState, camera, resources, cameraState, interactionState, picking, interactions, shellState, callbacks }) {
    const { $, matchMedia } = dom;
    function loop() {
        lifetime.frame(loop);
        const _n = clock.now(), dt = Math.min(.05, (_n - (renderState.lastFrameTime ?? _n)) / 1000);
        renderState.lastFrameTime = _n;
        const kk = r => matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1 - Math.exp(-dt * r);
        camera.cameraTick(_n, dt);
        const now = clock.now(), ease = t => t * t * (3 - 2 * t);
        renderState.settling = renderState.settling.filter(a => {
            const t = Math.min(1, (now - a.start) / 340), travel = Math.max(0, Math.min(1, (t - .2) / .6)), k = 1 - ease(travel), z = a.lift * (t < .2 ? ease(t / .2) : t > .8 ? 1 - ease((t - .8) / .2) : 1);
            a.group.position.set(a.dx * k, a.dy * k, z);
            return t < 1;
        });
        resources.cam.position.set(cameraState.tgt.x + cameraState.dist * Math.cos(cameraState.el) * Math.sin(cameraState.az), cameraState.tgt.y + cameraState.dist * Math.sin(cameraState.el), cameraState.tgt.z + cameraState.dist * Math.cos(cameraState.el) * Math.cos(cameraState.az));
        resources.cam.lookAt(cameraState.tgt);
        const near = camera.cameraNearDistance(cameraState.dist);
        if (resources.cam.near !== near) {
            resources.cam.near = near;
            resources.cam.updateProjectionMatrix();
        }
        if (Math.abs(cameraState.vsT - cameraState.vs) > .2 || Math.abs(cameraState.vzT - cameraState.vz) > .002) {
            cameraState.vs += (cameraState.vsT - cameraState.vs) * kk(8);
            cameraState.vz += (cameraState.vzT - cameraState.vz) * kk(8);
            camera.applyView();
        }
        else if (cameraState.vs !== cameraState.vsT || cameraState.vz !== cameraState.vzT) {
            cameraState.vs = cameraState.vsT;
            cameraState.vz = cameraState.vzT;
            camera.applyView();
        }
        // While the view settles, re-grab the dragged item under the pointer so it never jumps. The grab offset stays inside the item.
        if (interactionState.drag && interactionState.drag.started && interactionState.drag.settling && interactionState.lastMoveEvent) {
            resources.cam.updateMatrixWorld(true);
            const q = picking.frontPoint(interactionState.lastMoveEvent);
            if (q) {
                interactionState.drag.offsetX = Math.max(-interactionState.drag.hw, Math.min(interactionState.drag.hw, q.x - interactionState.drag.cx));
                interactionState.drag.offsetY = Math.max(-interactionState.drag.hh, Math.min(interactionState.drag.hh, q.y - interactionState.drag.cy));
            }
            interactions.previewAt(interactionState.lastMoveEvent);
            if (!cameraState.camGoal && cameraState.vs === cameraState.vsT && cameraState.vz === cameraState.vzT) {
                interactionState.drag.settling = false;
            }
        }
        renderState.pivots.forEach(p => p.rotation.y += ((p.userData.state.open ? p.userData.t : 0) - p.rotation.y) * kk(8));
        resources.R.render(resources.scene, resources.cam);
        const r = resources.cv.getBoundingClientRect();
        callbacks.positionLabels();
        const s = Math.floor((Date.now() - shellState.t0) / 1000);
        $('#clock').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        const zv = Math.round(cameraState.fitDist / cameraState.dist * 100) + '%', ze = $('#zoom-val');
        if (ze.textContent !== zv) {
            ze.textContent = zv;
        }
    }
    return { loop };
}
