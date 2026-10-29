import * as THREE from 'three';
import { assemblyParts, assemblyPose, assemblyTimeline } from './assembly-model';
import { assemblyMaterials, panelGeometry } from './assembly-materials';
import { drawingEdges, assemblyDimensions } from './assembly-drawing';
import type { StudyState } from './study';

export interface AssemblyScene {
  update(state: StudyState, progress: number): void;
  reset(): void;
  dispose(): void;
}

/** An on-demand renderer: no animation loop runs while the study is still or offscreen. */
export function createAssemblyScene(host: HTMLElement, label: string, unavailable: string): AssemblyScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  const canvas = renderer.domElement;
  canvas.className = 'assembly-webgl'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', label);
  canvas.tabIndex = 0; canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  const scene = new THREE.Scene(), object = new THREE.Group();
  const orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, .05, 70);
  let aspect = 1, state: StudyState = { width: 240, shape: 'regular', finish: 'chalk', inches: false };
  let pending = 0, disposed = false, visible = true, lost = false, yaw = .43, pitch = .21, progress = 0;
  let width = 240, shape = '';
  let parts = assemblyParts(width, 'regular');
  let timeline = assemblyTimeline(parts);
  const bounds = new THREE.Box3(), center = new THREE.Vector3(), direction = new THREE.Vector3();
  const right = new THREE.Vector3(), cameraUp = new THREE.Vector3(), corner = new THREE.Vector3();
  const geometries = new Set<THREE.BufferGeometry>();
  const request = () => { if (!disposed && visible && !lost && !pending) pending = requestAnimationFrame(render); };
  const materials = assemblyMaterials();
  const dimensions = assemblyDimensions(host);
  host.dataset.projection = 'orthographic';
  scene.add(object);
  const screwGeometry = new THREE.CylinderGeometry(.006, .006, .003, 12);
  const slotGeometry = new THREE.BoxGeometry(.006, .0008, .001);
  const pinGeometry = new THREE.CylinderGeometry(.003, .003, .025, 8);
  const handleGeometry = new THREE.CylinderGeometry(.004, .004, .16, 12);
  const hardware = (group: THREE.Group, size: readonly [number, number, number], kind: string) => {
    const [w, h, d] = size;
    if (kind === 'drawer') {
      const handle = new THREE.Mesh(handleGeometry, materials.ink); handle.rotation.z = Math.PI / 2;
      handle.position.set(0, h * .28, d / 2 + .022); group.add(handle);
      for (const x of [-.065, .065]) {
        const mount = new THREE.Mesh(pinGeometry, materials.ink); mount.rotation.x = Math.PI / 2;
        mount.position.set(x, h * .28, d / 2 + .01); group.add(mount);
      }
    } else if (w < .03 && h > .5) {
      for (const y of [-h / 2 + .07, h / 2 - .07]) for (const z of [-d / 2 + .055, d / 2 - .055]) {
        const screw = new THREE.Mesh(screwGeometry, materials.ink); screw.rotation.z = Math.PI / 2;
        screw.position.set(w / 2 + .001, y, z); group.add(screw);
        const slot = new THREE.Mesh(slotGeometry, materials.ink); slot.position.y = .0018; screw.add(slot);
      }
    } else if (h < .03 && d > .4) {
      for (const x of [-w / 2 + .035, w / 2 - .035]) for (const z of [-d / 2 + .06, d / 2 - .06]) {
        const pin = new THREE.Mesh(pinGeometry, materials.ink); pin.position.set(x, -.012, z); group.add(pin);
      }
    }
  };
  function rebuild() {
    for (const geometry of geometries) geometry.dispose(); geometries.clear(); object.clear();
    parts = assemblyParts(width, shape as StudyState['shape']);
    timeline = assemblyTimeline(parts);
    for (const part of parts) {
      const group = new THREE.Group();
      const geometry = part.kind === 'rail' ? new THREE.CylinderGeometry(.009, .009, part.size[0], 20) : panelGeometry(part);
      if (part.kind === 'rail') geometry.rotateZ(Math.PI / 2);
      geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, part.kind === 'rail' ? materials.ink : materials.paper);
      group.add(mesh);
      const edge = drawingEdges(part); geometries.add(edge);
      const lines = new THREE.LineSegments(edge, materials.line); lines.name = 'drawing'; lines.renderOrder = 1; group.add(lines);
      hardware(group, part.size, part.kind); object.add(group);
    }
  }
  function render() {
    pending = 0; if (disposed || !visible || lost) return;
    const camera = orthographic;
    const motion = timeline(progress);
    parts.forEach((part, i) => {
      const group = object.children[i]!, pose = assemblyPose(part, i, motion);
      group.position.set(...pose.position); group.rotation.set(...pose.rotation);
    });
    const flat = (1 - Math.min(1, motion / .48)) ** 2;
    const elevation = pitch + .13 + flat * .44;
    direction.set(Math.sin(yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(yaw) * Math.cos(elevation));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw)); cameraUp.crossVectors(direction, right);
    object.updateMatrixWorld(true); bounds.setFromObject(object); bounds.getCenter(center);
    let halfHeight = 0;
    // Fit all eight corners with space for the overlaid controls, even mid-assembly or after rotation.
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corner.set(x, y, z).sub(center);
        halfHeight = Math.max(halfHeight, Math.abs(corner.dot(cameraUp)) / .7, Math.abs(corner.dot(right)) / (aspect * .72));
      }
    }
    orthographic.left = -halfHeight * aspect; orthographic.right = halfHeight * aspect;
    orthographic.top = halfHeight; orthographic.bottom = -halfHeight; orthographic.updateProjectionMatrix();
    camera.position.copy(center).addScaledVector(direction, 10);
    camera.lookAt(center);
    renderer.render(scene, camera);
    dimensions.update(camera, state, object.children[1]!, progress, true);
    host.dataset.ready = 'true';
  }
  const resize = new ResizeObserver(entries => {
    const bounds = entries[0]!.contentRect;
    if (bounds.width < 1 || bounds.height < 1) return;
    renderer.setSize(bounds.width, bounds.height, false);
    aspect = bounds.width / bounds.height;
    request();
  });
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0]!.isIntersecting; if (visible) request();
  }, { rootMargin: '100px' });
  let drag: { x: number; y: number; yaw: number; pitch: number; id: number } | null = null;
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, yaw, pitch, id: event.pointerId };
    host.classList.add('has-explored');
    canvas.setPointerCapture(event.pointerId); canvas.classList.add('is-dragging');
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    yaw = drag.yaw - (event.clientX - drag.x) * .006;
    pitch = Math.max(.02, Math.min(.7, drag.pitch + (event.clientY - drag.y) * .003)); request();
  };
  const up = () => { drag = null; canvas.classList.remove('is-dragging'); };
  const keydown = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    host.classList.add('has-explored');
    if (event.key === 'Home') { yaw = .43; pitch = .21; }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') yaw += event.key === 'ArrowLeft' ? -.12 : .12;
    else pitch = Math.max(.02, Math.min(.7, pitch + (event.key === 'ArrowUp' ? .06 : -.06)));
    request();
  };
  const contextLost = (event: Event) => {
    event.preventDefault(); lost = true; host.dataset.ready = 'lost';
    host.querySelector('.assembly-status')!.textContent = unavailable;
  };
  const contextRestored = () => { lost = false; request(); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
  canvas.addEventListener('keydown', keydown);
  host.append(canvas); resize.observe(host); intersection.observe(host);
  return {
    update(next, value) {
      if (disposed) return;
      state = next;
      const rebuilt = width !== state.width || shape !== state.shape;
      if (rebuilt) { width = state.width; shape = state.shape; rebuild(); }
      progress = Math.max(0, Math.min(1, value));
      request();
    },
    reset() { yaw = .43; pitch = .21; host.classList.remove('has-explored'); request(); },
    dispose() {
      disposed = true; cancelAnimationFrame(pending); resize.disconnect(); intersection.disconnect();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('lostpointercapture', up);
      canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
      canvas.removeEventListener('keydown', keydown);
      for (const geometry of geometries) geometry.dispose();
      for (const geometry of [screwGeometry, slotGeometry, pinGeometry, handleGeometry]) geometry.dispose();
      materials.dispose(); dimensions.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
