import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** A box of the scene to light: centre and size on the floor, height. Centimetres. */
export interface LitBounds { readonly x: number; readonly z: number; readonly w: number; readonly d: number; readonly h: number }

/** Light like a photographed interior rather than a game: a soft studio environment for the ambient light
 * and the reflections in wood, glass and metal; a low, warm sun from the front left that casts real soft
 * shadows (into the wardrobe, onto the floor, through a window); and a quiet sky fill so shadows are never
 * black. `fit` keeps the sun's shadow camera tight around what is on screen, so shadows stay crisp. */
export function createSceneLighting(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  pmrem.dispose();
  scene.environment = environment;

  const sky = new THREE.HemisphereLight(0xfff8ee, 0xc9b99c, .42);
  scene.add(sky);
  // Shadow maps are redrawn only when the scene changes (see the frame loop), not every frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const sun = new THREE.DirectionalLight(0xffeedb, 1.05);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.00025;
  sun.shadow.normalBias = .6;
  // Soft-edged, like daylight from a window rather than a spotlight.
  sun.shadow.radius = 7;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene.add(sun, sun.target);
  /** Where the key light comes from: mostly from the front, a little above and to the left, like a tall window
   * behind the photographer (the Cycles benchmark's key, scripts/realism/benchmark_scene.py). The wardrobe's back
   * is evenly lit with a soft shade under the top, instead of a hard patch of sun cut by a side panel. */
  const direction = new THREE.Vector3(-.08, .42, .9).normalize();

  function fit(bounds: LitBounds) {
    const reach = Math.max(bounds.w, bounds.d, bounds.h, 200) * .75 + 40;
    sun.target.position.set(bounds.x, 0, bounds.z);
    sun.position.copy(sun.target.position).addScaledVector(direction, reach * 3);
    const c = sun.shadow.camera;
    c.left = c.bottom = -reach;
    c.right = c.top = reach;
    c.near = reach;
    c.far = reach * 5;
    c.updateProjectionMatrix();
  }
  fit({ x: 0, z: 0, w: 300, d: 300, h: 250 });

  return {
    sun, fit,
    dispose() { scene.remove(sky, sun, sun.target); environment.dispose(); scene.environment = null; },
  };
}
