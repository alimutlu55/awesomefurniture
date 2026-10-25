import * as THREE from 'three';

const LENS = 35, FLATTEST = 6;
/** The dolly zoom of the workshop view: at amount 0 the editor's own lens; towards 1 the camera backs away as the
 * lens narrows, so what is at the target keeps its size while perspective flattens into an elevation drawing.
 * Returns the distance factor and the lens's vertical field of view in degrees. Pure. */
export function dollyZoom(amount: number): { factor: number; fov: number } {
  const factor = 1 + (FLATTEST - 1) * Math.max(0, Math.min(1, amount));
  return { factor, fov: 2 * Math.atan(Math.tan(LENS * Math.PI / 360) / factor) * 180 / Math.PI };
}

const GRID_VERTEX = `varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
// Lines every 10 cm, stronger every metre, drawn crisp at any distance and fading out around the design.
const GRID_FRAGMENT = `uniform vec3 centre; uniform float radius; uniform float strength; varying vec3 vWorld;
float lines(vec2 p, float step) { vec2 g = abs(fract(p / step - .5) - .5) / fwidth(p / step); return 1.0 - min(min(g.x, g.y), 1.0); }
void main() {
  float fade = 1.0 - smoothstep(radius * .45, radius, distance(vWorld.xz, centre.xz));
  float minor = lines(vWorld.xz, 10.0) * .22, major = lines(vWorld.xz, 100.0) * .55;
  float a = max(minor, major) * fade * strength;
  if (a < .003) discard;
  gl_FragColor = vec4(mix(vec3(.36, .58, .84), vec3(.72, .86, 1.0), step(minor, major)), a);
}`;

/**
 * The workshop's lens and drawing board: a blueprint grid on the floor, and the dolly zoom into a flat front
 * elevation. Runs after the editor has placed the camera each frame, and only changes the camera while the
 * workshop is shown, so every framing and gesture of the editor keeps working as it is.
 */
export function createWorkshopLens(scene: THREE.Scene) {
  const uniforms = { centre: { value: new THREE.Vector3() }, radius: { value: 600 }, strength: { value: 0 } };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: GRID_VERTEX, fragmentShader: GRID_FRAGMENT, transparent: true, depthWrite: false });
  material.extensions.derivatives = true;
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material);
  grid.position.y = .15;
  grid.renderOrder = 1;
  grid.raycast = () => {};
  grid.visible = false;
  scene.add(grid);
  let shown = 0, showGoal = 0, flat = 0, flatGoal = 0;

  /** Shows the drawing board (0 to 1), and how flat the lens is (0 the editor's lens, 1 an elevation). */
  function set({ board, flatten }: { board?: number; flatten?: number }) {
    if (board !== undefined) showGoal = board;
    if (flatten !== undefined) flatGoal = flatten;
  }
  /** Fits the board around the design: centre and size on the floor, in centimetres. */
  function fit(x: number, z: number, size: number) {
    uniforms.centre.value.set(x, 0, z);
    uniforms.radius.value = Math.max(400, size * 1.6);
    grid.position.set(x, .15, z);
    grid.scale.set(uniforms.radius.value * 2, 1, uniforms.radius.value * 2);
  }
  /** Eases towards the goals and applies the lens to a camera the editor has just aimed at `target`. */
  function frame(camera: THREE.PerspectiveCamera, target: THREE.Vector3, dt: number, instant = false) {
    const k = instant ? 1 : 1 - Math.exp(-dt * 3.2);
    shown += (showGoal - shown) * k; flat += (flatGoal - flat) * k;
    if (Math.abs(shown - showGoal) < .002) shown = showGoal;
    if (Math.abs(flat - flatGoal) < .001) flat = flatGoal;
    uniforms.strength.value = shown;
    grid.visible = shown > .002;
    const { factor, fov } = dollyZoom(flat);
    if (factor > 1.0001) {
      const reach = camera.position.distanceTo(target);
      camera.position.sub(target).multiplyScalar(factor).add(target);
      camera.near = Math.max(camera.near, reach * (factor - 1) * .55);
    }
    if (Math.abs(camera.fov - fov) > 1e-4 || factor > 1.0001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }
  /** Hides the board for a moment (a capture), whatever its state. */
  const hide = (hidden: boolean) => { grid.visible = !hidden && shown > .002; };
  return { set, fit, frame, hide, flatness: () => flat, dispose() { scene.remove(grid); grid.geometry.dispose(); material.dispose(); } };
}
