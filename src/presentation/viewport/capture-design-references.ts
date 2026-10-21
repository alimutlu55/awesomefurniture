import * as THREE from 'three';
import type { EditorScene } from '../../application/projects/editor-scene';
import { IMAGE_VIEWS, type DesignReferenceImage } from '../../application/projects/design-image';
import { createStudioRenderer } from './studio-renderer';

interface Bounds { x: number; z: number; w: number; d: number; h: number }
interface CapturePorts {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; document: Document;
  groups: readonly THREE.Object3D[]; ground: THREE.Object3D;
  settling: readonly { group: THREE.Object3D }[];
  bounds: Bounds; fit: (bounds: Bounds, az: number, el: number, aspect: number) => number;
  design: EditorScene;
}

/** Copy only physical geometry. Materials/textures are borrowed and never disposed or modified. */
export function photoGeometry(source: THREE.Object3D, settling?: ReadonlySet<THREE.Object3D>): THREE.Object3D {
  // Editor metadata can contain DOM nodes and references to other meshes. It is not part of a photograph.
  const metadata = source.userData;
  let clone: THREE.Object3D;
  try { source.userData = {}; clone = source.clone(false); }
  finally { source.userData = metadata; }
  if (source instanceof THREE.Mesh) {
    const material = metadata.origMaterial ?? source.material;
    (clone as THREE.Mesh).material = material;
    const materials: THREE.Material[] = Array.isArray(material) ? material : [material];
    // Selection glows, hit targets and handles use unlit, untextured overlay materials.
    if (materials.every(m => m.opacity === 0 || !m.depthTest
      || (m instanceof THREE.MeshBasicMaterial && m.transparent && !m.map))) clone.visible = false;
  }
  if (source instanceof THREE.Line || source instanceof THREE.Sprite) clone.visible = false;
  if (typeof metadata.t === 'number' && metadata.state) clone.rotation.y = 0; // Close doors, independent of their animation.
  if (settling?.has(source)) clone.position.set(0, 0, 0); // Fitting move animations offset the resolved geometry temporarily.
  for (const child of source.children) clone.add(photoGeometry(child, settling));
  return clone;
}

/** Three clean 1440 × 1080 views, rendered off screen without changing the editor camera or canvas size. */
export function captureDesignReferences(ports: CapturePorts): DesignReferenceImage[] {
  const { renderer, scene, camera, document, bounds, fit, design } = ports;
  if (renderer.getContext().isContextLost()) throw new Error('The 3D view is unavailable. Reload the editor and try again.');
  const photo = new THREE.Scene();
  photo.environment = scene.environment;
  const settling = new Set(ports.settling.map(entry => entry.group));
  for (const group of ports.groups) {
    const clone = photoGeometry(group, settling);
    clone.visible = true; // Include furniture hidden by selection occlusion.
    photo.add(clone);
  }
  const kitchen = scene.getObjectByName('kitchen-runs');
  if (kitchen) photo.add(photoGeometry(kitchen));
  if (ports.ground.visible) photo.add(photoGeometry(ports.ground));
  for (const child of scene.children) {
    if (child instanceof THREE.Light) {
      const light = child.clone();
      photo.add(light);
      if (light instanceof THREE.DirectionalLight) {
        light.shadow.normalBias = (child as THREE.DirectionalLight).shadow.normalBias;
        photo.add(light.target);
      }
    }
  }
  const studio = createStudioRenderer(photo);
  const target = renderer.capabilities.isWebGL2
    ? new THREE.WebGLMultisampleRenderTarget(1440, 1080) : new THREE.WebGLRenderTarget(1440, 1080);
  target.texture.encoding = THREE.sRGBEncoding;
  const previousTarget = renderer.getRenderTarget();
  const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 1080;
  const context = canvas.getContext('2d');
  const pixels = new Uint8Array(1440 * 1080 * 4);
  try {
    if (!context) throw new Error('Unable to prepare the reference images.');
    studio.sync(design.studio, design.wardrobes.map(w => ({ x: w.x, z: w.z, angle: w.angle, w: w.state.w, d: w.state.d })));
    const facing = (design.wardrobes[0]?.angle ?? 0) * Math.PI / 180;
    return IMAGE_VIEWS.map((view, index) => {
      const az = facing + [0, -.58, .58][index]!, el = index === 0 ? .12 : .34;
      const distance = fit(bounds, az, el, 4 / 3) * 1.1;
      const shot = camera.clone();
      shot.clearViewOffset(); shot.aspect = 4 / 3; shot.zoom = 1;
      shot.near = Math.max(1, Math.min(50, distance * .005));
      shot.position.set(bounds.x + distance * Math.cos(el) * Math.sin(az),
        bounds.h / 2 + distance * Math.sin(el), bounds.z + distance * Math.cos(el) * Math.cos(az));
      shot.lookAt(bounds.x, bounds.h / 2, bounds.z); shot.updateProjectionMatrix(); shot.updateMatrixWorld(true);
      studio.frame(shot, 100); // Resolve room cutaways for this camera, with no selection or animation.
      photo.traverse(object => { if (object instanceof THREE.Line) object.visible = false; });
      renderer.setRenderTarget(target);
      renderer.shadowMap.needsUpdate = true;
      renderer.render(photo, shot);
      renderer.readRenderTargetPixels(target, 0, 0, 1440, 1080, pixels);
      const frame = context.createImageData(1440, 1080);
      for (let y = 0; y < 1080; y++) {
        frame.data.set(pixels.subarray((1079 - y) * 1440 * 4, (1080 - y) * 1440 * 4), y * 1440 * 4);
      }
      context.putImageData(frame, 0, 0);
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#e7e1d6'; context.fillRect(0, 0, 1440, 1080);
      context.globalCompositeOperation = 'source-over';
      return { view, mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', .9).split(',')[1]!, width: 1440, height: 1080,
        camera: { position: shot.position.toArray(), target: [bounds.x, bounds.h / 2, bounds.z], fov: shot.fov } };
    });
  } finally {
    renderer.setRenderTarget(previousTarget);
    target.dispose(); studio.dispose();
    photo.traverse(object => {
      if (object instanceof THREE.DirectionalLight) (object.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
    });
    photo.clear();
    renderer.shadowMap.needsUpdate = true;
  }
}
