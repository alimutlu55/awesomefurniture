import * as THREE from 'three';
import { PLANK_TILE, planks } from './studio-surfaces';

/** The floor wardrobes stand on when there is no room: oak boards that fade softly into the background
 * around them, like a showroom photograph, and take their shadows. Hidden in a room, which has its own
 * floor. `fit` centres it on what is on screen. Centimetres. */
export function createStageFloor(scene: THREE.Scene) {
  const boards = planks();
  // Fades out with distance from the wardrobes, computed per pixel (a mask texture would tile with the boards).
  const fade = { centre: { value: new THREE.Vector3() }, inner: { value: 150 }, outer: { value: 400 } };
  const material = new THREE.MeshStandardMaterial({ map: boards, transparent: true, depthWrite: false, color: new THREE.Color('#efe6da').convertSRGBToLinear(), roughness: .55, envMapIntensity: .4 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { fadeCentre: fade.centre, fadeInner: fade.inner, fadeOuter: fade.outer });
    shader.vertexShader = 'varying vec3 vFadeWorld;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vFadeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'uniform vec3 fadeCentre;\nuniform float fadeInner;\nuniform float fadeOuter;\nvarying vec3 vFadeWorld;\n'
      + shader.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a *= 1.0 - smoothstep(fadeInner, fadeOuter, distance(vFadeWorld.xz, fadeCentre.xz));');
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material);
  mesh.position.y = -.05;
  mesh.receiveShadow = true;
  mesh.renderOrder = -1;
  scene.add(mesh);

  function fit(x: number, z: number, size: number) {
    const s = Math.max(500, size * 2.6);
    mesh.position.set(x, -.05, z);
    mesh.scale.set(s, 1, s);
    fade.centre.value.set(x, 0, z);
    fade.inner.value = s * .2;
    fade.outer.value = s * .48;
    // Boards keep their real size whatever the floor's size.
    boards.repeat.set(s / PLANK_TILE.long, s / PLANK_TILE.wide);
    boards.offset.set((x - s / 2) / PLANK_TILE.long, (z - s / 2) / PLANK_TILE.wide);
  }
  fit(0, 0, 300);

  return {
    mesh, fit,
    dispose() { scene.remove(mesh); mesh.geometry.dispose(); material.dispose(); boards.dispose(); },
  };
}
