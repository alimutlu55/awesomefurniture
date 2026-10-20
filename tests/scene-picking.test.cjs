const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { createScenePicking } = require('../src/presentation/editor/scene-picking.js');

for (const reverse of [false, true]) test(`a divider owns the overlap with adjacent fitting hit boxes regardless of build order ${reverse}`, () => {
    const cam = new THREE.PerspectiveCamera(35, 1, 1, 2000);
    cam.position.set(0, 100, 500); cam.lookAt(0, 100, 0); cam.updateMatrixWorld(true);
    const group = new THREE.Group(), material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    // The fitting touches the real 1.8 cm board; the board's 5 cm pointer target
    // deliberately overlaps that fitting to make the thin board grabbable.
    const fitting = new THREE.Mesh(new THREE.BoxGeometry(47.3, 120, 60), material);
    fitting.position.set(-24.55, 100, 0); fitting.userData = { wardrobe: 1, i: 0, j: 0 };
    const divider = new THREE.Mesh(new THREE.BoxGeometry(5, 160, 60), material);
    divider.position.y = 100; divider.userData = { wardrobe: 1, i: 0, divider: 0 };
    group.add(fitting, divider); group.updateMatrixWorld(true);
    const picking = createScenePicking({ dom: {}, interactionState: { ray: new THREE.Raycaster() }, renderState: {},
        resources: { cam, cv: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }) } }, model: {} });
    const point = new THREE.Vector3(-1.5, 100, 30).project(cam);
    const e = { clientX: (point.x + 1) * 400, clientY: (1 - point.y) * 400 };
    assert.equal(picking.cast(e, reverse ? [divider, fitting] : [fitting, divider]).object, divider);
    // A closer foreground fitting must still own its own pixels.
    fitting.position.z = 15; group.updateMatrixWorld(true);
    assert.equal(picking.cast(e, [divider, fitting]).object, fitting);
});
