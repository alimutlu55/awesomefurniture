import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { sizeCanvasAdd } from '../../src/presentation/viewport/canvas-add-sizing';

function fixture() {
    const view = { width: 375, height: 812 }, camera = new PerspectiveCamera(50, view.width / view.height, 1, 10000);
    camera.position.set(0, 75, 500); camera.lookAt(0, 75, 0); camera.updateMatrixWorld();
    const label = { el: { offsetWidth: 118, offsetHeight: 32 } as HTMLElement, owner: new Group(), canvasScale: undefined as number | undefined,
        addArea: { left: new Vector3(-50, 75, 0), right: new Vector3(50, 75, 0), bottom: new Vector3(0, 0, 0), top: new Vector3(0, 150, 0) } };
    return { view, camera, label, scale: () => { sizeCanvasAdd(label, camera, view); return label.canvasScale!; } };
}

test('the complete Add item button shrinks proportionally with perspective zoom', () => {
    const { camera, scale } = fixture(), near = scale();
    assert.ok(near > 0 && near < 1);
    camera.position.z *= 2; camera.updateMatrixWorld();
    assert.ok(Math.abs(scale() - near / 2) < .00001);
    camera.position.z = 10; camera.updateMatrixWorld(); assert.equal(scale(), 1, 'zooming in never makes the normal button larger');
});

test('a narrow, low or angled compartment bounds the button instead of letting it cover the wardrobe', () => {
    const { label, scale } = fixture(), normal = scale();
    label.addArea.right.x = -40; assert.ok(scale() < normal / 5);
    label.addArea.right.x = 50; label.addArea.top.y = 10; assert.ok(scale() < normal / 2);
    label.addArea.top.y = 150; label.owner.rotation.y = Math.PI / 3; label.owner.updateMatrixWorld();
    assert.ok(scale() < normal * .6);
});
