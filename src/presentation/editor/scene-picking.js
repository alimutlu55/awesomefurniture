import * as THREE from "three";
/** @param {import('./scene-picking.ports').CreateScenePickingPorts} ports */
export function createScenePicking({ dom, interactionState, renderState, resources, model }) {
    function frontPoint(e) {
        const r = resources.cv.getBoundingClientRect();
        interactionState.ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, resources.cam);
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -model.activeCabinet().state.d / 2).applyMatrix4(renderState.Gr.matrixWorld), point = interactionState.ray.ray.intersectPlane(plane, new THREE.Vector3());
        return point ? renderState.Gr.worldToLocal(point) : null;
    }
    function cast(e, arr) {
        const r = resources.cv.getBoundingClientRect();
        interactionState.ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, resources.cam);
        // A wardrobe hidden because it blocks the view takes no clicks: they reach what is behind it.
        return interactionState.ray.intersectObjects(arr).find(h => shown(h.object));
    }
    /** Whether the object's top group (a wardrobe, or the room) is on show. */
    function shown(object) {
        let o = object;
        while (o.parent && o.parent.type !== 'Scene') o = o.parent;
        return o.visible;
    }
    function hitAt(e) {
        const h = cast(e, renderState.hits);
        return h ? h.object.userData.i : -1;
    }
    function groundPoint(e, height = 0) {
        const r = resources.cv.getBoundingClientRect();
        interactionState.ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, resources.cam);
        return interactionState.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3());
    }
    function screenPoint(p) {
        const r = resources.cv.getBoundingClientRect(), q = p.clone().project(resources.cam);
        return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height };
    }
    return { frontPoint, cast, hitAt, groundPoint, screenPoint };
}
