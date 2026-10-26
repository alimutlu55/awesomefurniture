const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCameraController } = require('../src/presentation/viewport/camera-controller.js');
const { createCameraState } = require('../src/presentation/viewport/camera-state.ts');
const { createCabinetGeometry } = require('../src/domain/geometry/cabinet-geometry.js');
const { createStudio } = require('../src/domain/studio/studio-templates.ts');
const { createTouchCamera } = require('../src/presentation/editor/touch-camera.ts');
const { bindCanvasWheel } = require('../src/presentation/editor/bindings/canvas.js');

function fixture(width, height, reducedMotion) {
  const rect = { width, height, left: 0, top: 0, right: width, bottom: height };
  const element = { getBoundingClientRect: () => rect, classList: { contains: () => false } };
  const dom = { width, $: () => element, document: { querySelector: () => null } };
  const scene = { wardrobes: [], studio: createStudio('wall') };
  const cameraState = createCameraState({ reducedMotion: { matches: reducedMotion } });
  const camera = createCameraController({
    dom, cameraState, model: { scene }, cabinetGeometry: createCabinetGeometry(() => scene.wardrobes),
    picking: { cast: () => ({ point: cameraState.tgt.clone() }) },
    inspector: {}, resources: {}, renderState: {}, interactionState: {}, geometry: {},
  });
  const overview = camera.fittedCamera(0, .08, 1.05, camera.sceneBox());
  camera.cameraApply({ ...overview, dist: overview.dist * 1.5 });
  const handlers = {};
  const lifetime = { listen: (_target, name, handler) => { handlers[name] = handler; }, cleanup() {} };
  bindCanvasWheel({ dom, camera, resources: {}, interactionState: {}, interactions: { cancelMovement() {} }, lifetime });
  const touch = createTouchCamera({ dom, camera, cameraState, lifetime, picking: {} });
  const settle = () => { for (let n = 0; n < 160; n++) camera.cameraTick(0, 1 / 60); };
  return { camera, cameraState, overview, handlers, touch, settle };
}

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const point = x => ({ clientX: x, clientY: 200 });

for (const [width, height] of [[2048, 1123], [390, 844]]) {
  for (const reducedMotion of [false, true]) {
    test(`${width}px, reduced motion ${reducedMotion}: wheel zoom continues past the empty-wall overview`, () => {
      const f = fixture(width, height, reducedMotion), start = f.cameraState.dist;
      // Reproduce the old stopping point, then send real canvas wheel events.
      f.cameraState.tgt.set(80, 30, -40);
      for (let n = 0; n < 5; n++) f.handlers.wheel({ deltaY: 100, deltaMode: 0, preventDefault() {} });
      f.settle();
      close(f.cameraState.dist, start * Math.exp(.15 * 5));
      assert.ok(f.cameraState.dist > start * 2, 'zoom-out must continue past the old scene-relative cap');
      for (const axis of ['x', 'y', 'z']) close(f.cameraState.tgt[axis], f.overview[axis]);
      f.camera.cameraZoom(1e10); f.settle();
      close(f.cameraState.dist, 15000);
      f.camera.cameraZoom(1.2); f.settle();
      close(f.cameraState.dist, 15000);
    });

    test(`${width}px, reduced motion ${reducedMotion}: touch pinch can pull back past the empty-wall overview`, () => {
      const f = fixture(width, height, reducedMotion), start = f.cameraState.dist;
      f.cameraState.tgt.set(80, 30, -40);
      f.touch.pinch([point(100), point(300)], [point(150), point(250)]);
      close(f.cameraState.dist, start * 2);
      for (const axis of ['x', 'y', 'z']) close(f.cameraState.tgt[axis], f.overview[axis]);
      for (let n = 0; n < 8; n++) f.touch.pinch([point(100), point(300)], [point(150), point(250)]);
      close(f.cameraState.dist, 15000);
    });
  }
}
