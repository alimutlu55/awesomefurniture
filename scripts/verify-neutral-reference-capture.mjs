import * as THREE from 'three';
import { captureDesignReferences } from '../src/presentation/viewport/capture-design-references.ts';

/** Real GPU regression: differently oriented faces must retain the configured sRGB color despite warm scene lights. */
export async function verifyNeutralReferenceCapture() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.7; renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(), group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color('#7eafc2').convertSRGBToLinear(), metalness: .6 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), material);
  mesh.position.y = 50; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); scene.add(group);
  const sun = new THREE.DirectionalLight('#ff6600', 5); sun.castShadow = true; scene.add(sun);
  const ground = new THREE.Object3D(); ground.visible = false;
  const design = { wardrobes: [{ x: 0, z: 0, angle: 0, state: { w: 100, h: 100, d: 100 } }] };
  const ports = { renderer, scene, groups: [group], ground, design, settling: [], document };
  const check = (valid, message) => { if (!valid) throw new Error(message); };
  const restored = () => renderer.getRenderTarget() === null && renderer.toneMapping === THREE.ACESFilmicToneMapping
    && renderer.toneMappingExposure === 1.7 && renderer.shadowMap.enabled && mesh.material === material && mesh.castShadow && mesh.receiveShadow;
  try {
    const references = captureDesignReferences(ports);
    check(restored(), 'Capture changed the live renderer or source furniture');
    for (const reference of references) {
      const image = new Image(); image.src = `data:image/jpeg;base64,${reference.data}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const camera = new THREE.PerspectiveCamera(reference.camera.fov, image.width / image.height, 1, 50000);
      camera.position.fromArray(reference.camera.position); camera.lookAt(new THREE.Vector3().fromArray(reference.camera.target));
      camera.updateMatrixWorld(true);
      for (const point of [new THREE.Vector3(0, 50, 50), new THREE.Vector3(0, 100, 0)]) {
        point.project(camera);
        const pixel = context.getImageData(Math.round((point.x + 1) * image.width / 2), Math.round((1 - point.y) * image.height / 2), 1, 1).data;
        check([126, 175, 194].every((channel, index) => Math.abs(channel - pixel[index]) <= 3),
          `${reference.view} changed the configured color: ${Array.from(pixel)}`);
      }
    }
    const render = renderer.render;
    renderer.render = () => { throw new Error('intentional capture failure'); };
    let failed = false;
    try { captureDesignReferences(ports); } catch { failed = true; }
    renderer.render = render;
    check(failed && restored(), 'Failed capture did not restore renderer settings');
    return true;
  } finally {
    material.dispose(); mesh.geometry.dispose(); renderer.dispose(); renderer.forceContextLoss();
  }
}
