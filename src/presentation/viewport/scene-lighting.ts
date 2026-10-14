import * as THREE from 'three';


/** A box of the scene to light: centre and size on the floor, height. Centimetres. */
export interface LitBounds { readonly x: number; readonly z: number; readonly w: number; readonly d: number; readonly h: number }

/** Drape Lab room illumination, with shadow bounds fitted to the editor's centimetre scene. */
export function createSceneLighting(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8d877d).convertSRGBToLinear(), side: THREE.BackSide })));
  function panel(w: number, h: number, position: [number, number, number], strength: number, color: [number, number, number]) {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    material.color.setRGB(color[0] * strength, color[1] * strength, color[2] * strength);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  }
  panel(4, 3, [-3.2, 1.8, 3.6], 4.5, [1, .96, .9]);
  panel(5, 5, [0, 2.9, 0], 2.2, [1, .98, .95]);
  panel(3, 2, [3.6, .8, 2.4], 1, [.85, .9, 1]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6e5a42).convertSRGBToLinear() }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.6;
  room.add(floor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(room, .03);
  pmrem.dispose();
  room.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
  scene.environment = environmentTarget.texture;

  // r128 expects light colours in linear space; the reference uses automatic colour management.
  const linear = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();
  const ambient = new THREE.AmbientLight(0xffffff, .06);
  const sky = new THREE.HemisphereLight(linear(0xfff1de), linear(0x6b5a46), .2);
  const fill = new THREE.DirectionalLight(linear(0xdfe8ff), .25);
  fill.position.set(220, 140, 220);
  const sun = new THREE.DirectionalLight(linear(0xfff3e4), 1.1);
  scene.add(ambient, sky, fill, sun, sun.target);
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0006;
  sun.shadow.normalBias = .6;
  const direction = new THREE.Vector3(-1.4, 2.1, 2.6).normalize();

  function fit(bounds: LitBounds) {
    const reach = Math.max(bounds.w, bounds.d, bounds.h, 200) * .75 + 40;
    // Centred on the scene's middle height, not the floor: centred on the floor, the shadow camera's reach left the
    // top of a tall wardrobe outside it, unshadowed (a lit stripe under the top).
    sun.target.position.set(bounds.x, bounds.h / 2, bounds.z);
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
    dispose() { scene.remove(ambient, sky, fill, sun, sun.target); environmentTarget.dispose(); scene.environment = null; },
  };
}
