import * as THREE from "three";
/** @param {import('./scene-picking.ports').CreateScenePickingPorts} ports */
export function createScenePicking({ dom, interactionState, renderState, resources, model }) {
    function frontPoint(e, side = 'front') {
        const r = resources.cv.getBoundingClientRect();
        interactionState.ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, resources.cam);
        const depth = (side === 'rear' ? 1 : -1) * model.activeCabinet().state.d / 2;
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), depth).applyMatrix4(renderState.Gr.matrixWorld);
        const point = interactionState.ray.ray.intersectPlane(plane, new THREE.Vector3());
        return point ? renderState.Gr.worldToLocal(point) : null;
    }
    function cast(e, arr) {
        const r = resources.cv.getBoundingClientRect();
        interactionState.ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, resources.cam);
        // A wardrobe hidden because it blocks the view takes no clicks: they reach what is behind it.
        const hits = interactionState.ray.intersectObjects(arr).filter(h => shown(h.object)), first = hits[0];
        // Thin boards have a wider pointer target, which overlaps adjacent
        // fitting volumes at the same front plane. The board owns that overlap;
        // insertion order must not make it impossible to select or drag.
        return first && (hits.find(h => h.object.userData.divider !== undefined
            && h.object.userData.wardrobe === first.object.userData.wardrobe
            && Math.abs(h.distance - first.distance) < .0001) ?? first);
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
    /** Whether a mesh is drawn: it and everything it hangs from are visible, and it is not a shadow. */
    const onShow = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return o.isMesh && o.material?.visible !== false && !o.userData.floorShadow; };
    /** The wardrobe or cabinet whose boards are under the pointer, its frame (sides, top, plinth) included, or undefined. */
    function pieceAt(e) {
        const r = resources.cv.getBoundingClientRect();
        interactionState.ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, resources.cam);
        let g = interactionState.ray.intersectObjects(renderState.wardrobeGroups, true).find(h => onShow(h.object))?.object;
        while (g && !renderState.wardrobeGroups.includes(g)) g = g.parent;
        return g?.userData.wardrobe;
    }
    /** The first surface on show (a wall, the floor, furniture) on the line from `origin` through `toward`, no further
     * than `far` centimetres, or null. Hit boxes and hidden parts are seen through. */
    function surfaceAlong(origin, toward, far) {
        const from = new THREE.Vector3(origin.x, origin.y, origin.z), ray = interactionState.ray;
        ray.set(from, new THREE.Vector3(toward.x, toward.y, toward.z).sub(from).normalize());
        ray.far = far;
        const hit = ray.intersectObjects(resources.scene.children, true).find(h => onShow(h.object));
        ray.far = Infinity;
        return hit ? hit.point.clone() : null;
    }
    function screenPoint(p) {
        const r = resources.cv.getBoundingClientRect(), q = p.clone().project(resources.cam);
        return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height };
    }
    return { frontPoint, cast, hitAt, groundPoint, screenPoint, surfaceAlong, pieceAt };
}
