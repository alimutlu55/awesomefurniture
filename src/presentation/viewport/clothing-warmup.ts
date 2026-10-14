import * as THREE from 'three';
import { createGarmentMaterials } from './garment-materials';
import { buildGarmentGeometry, makeGarmentSpec } from './garment-shape';

/** Keep the woven-cloth shader variants alive so the first rail does not compile them on interaction. */
export function createClothingWarmup(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, document: Document) {
  let disposed = false, prepared = false;
  let geometry: THREE.BufferGeometry | undefined;
  let materials: THREE.Material[] = [];
  function prepare() {
    if (disposed || prepared) return;
    prepared = true;

    geometry = buildGarmentGeometry(makeGarmentSpec(11, 160, 43, '#c9d3e0', false, 'shirt'));
    geometry.center();
    materials = [
      ...createGarmentMaterials('poplin', new THREE.Color('#c9d3e0').convertSRGBToLinear(), document),
      new THREE.MeshStandardMaterial({ color: '#b4b8bd', metalness: .6, roughness: .4 }),
      new THREE.LineBasicMaterial({ color: '#403b36' }),
    ];
    const samples = new THREE.Group();
    for (const material of materials) {
      const mesh = material instanceof THREE.LineBasicMaterial
        ? new THREE.LineSegments(geometry, material) : new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      samples.add(mesh);
    }
    // Cover the test tile so the driver prepares the fragment pipeline too, not only the shader source.
    const distance = Math.max((camera as THREE.PerspectiveCamera).near * 2, 10);
    samples.position.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), distance);
    samples.quaternion.copy(camera.quaternion);
    samples.scale.setScalar(distance / 10);
    samples.children.forEach((mesh, i) => { mesh.position.z = i * .01; });
    // Use the screen framebuffer too: drivers can specialize programs for a framebuffer's format.
    // Scissor to a small corner tile; the next normal frame repaints it.
    const previousScissor = renderer.getScissor(new THREE.Vector4());
    const previousScissorTest = renderer.getScissorTest();
    const shadowSample = new THREE.Mesh(geometry, materials.slice(0, 3));
    const keyLight = scene.children.find(object => object instanceof THREE.DirectionalLight && object.castShadow) as THREE.DirectionalLight | undefined;
    shadowSample.position.copy(keyLight?.target.position ?? new THREE.Vector3());
    shadowSample.castShadow = true;
    shadowSample.frustumCulled = false;
    scene.add(shadowSample, samples);
    try {
      renderer.shadowMap.needsUpdate = true;
      renderer.setScissor(0, 0, 16, 16);
      renderer.setScissorTest(true);
      renderer.render(scene, camera);
    } finally {
      scene.remove(samples, shadowSample);
      renderer.setScissor(previousScissor);
      renderer.setScissorTest(previousScissorTest);
      // Remove the stand-in from the shadow map on the next regular frame.
      renderer.shadowMap.needsUpdate = true;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    geometry?.dispose();
    materials.forEach(material => material.dispose());
    materials = [];
  }
  return { prepare, dispose };
}
