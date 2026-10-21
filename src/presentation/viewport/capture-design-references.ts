import * as THREE from 'three';
import type { EditorScene } from '../../application/projects/editor-scene';
import type { DesignReferenceImage } from '../../application/projects/design-image';
import { createStudioRenderer } from './studio-renderer';
import { DesignImageUserError } from '../ai/design-image-errors';

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

/** Computes camera azimuth, elevation, framing bounds, and target based on furniture layout and orientation. */
function planCameraShots(wardrobes: readonly { x: number; z: number; angle?: number; state: { w: number; h: number; d: number } }[], bounds: Bounds) {
  const targetY = Math.min(145, Math.max(110, bounds.h * 0.48));
  const fallback = [
    { view: 'front' as const, az: 0, el: 0.12, target: [bounds.x, targetY, bounds.z] as [number, number, number], bounds },
    { view: 'left' as const, az: -0.48, el: 0.22, target: [bounds.x, targetY, bounds.z] as [number, number, number], bounds },
    { view: 'right' as const, az: 0.48, el: 0.22, target: [bounds.x, targetY, bounds.z] as [number, number, number], bounds },
  ];
  if (!wardrobes.length) return fallback;

  // Group furniture into wings by facing direction (tolerance ~20 degrees = 0.35 rad)
  const toRad = (deg: number) => ((deg % 360 + 360) % 360) * Math.PI / 180;
  type Piece = typeof wardrobes[number];
  interface Wing { meanAngle: number; pieces: Piece[] }
  const wings: Wing[] = [];

  for (const piece of wardrobes) {
    const rad = toRad(piece.angle ?? 0);
    let matched = false;
    for (const wing of wings) {
      const diff = Math.atan2(Math.sin(rad - wing.meanAngle), Math.cos(rad - wing.meanAngle));
      if (Math.abs(diff) < 0.35) {
        wing.pieces.push(piece);
        matched = true;
        break;
      }
    }
    if (!matched) wings.push({ meanAngle: rad, pieces: [piece] });
  }

  // Sort wings by total width/volume so the two most significant runs take priority
  wings.sort((a, b) => b.pieces.reduce((sum, p) => sum + p.state.w, 0) - a.pieces.reduce((sum, p) => sum + p.state.w, 0));

  if (wings.length >= 2) {
    // Multi-wing / L-shaped layout:
    // View 1 (front): diagonal 3/4 hero view bisecting both wings, looking into the corner junction
    const w1 = wings[0]!, w2 = wings[1]!;
    const nx = Math.sin(w1.meanAngle) + Math.sin(w2.meanAngle);
    const nz = Math.cos(w1.meanAngle) + Math.cos(w2.meanAngle);
    const bisector = Math.atan2(nx, nz);

    // Compute localized bounding box for each wing
    const wingBounds = (wing: Wing): Bounds => {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 0;
      for (const p of wing.pieces) {
        const radius = Math.max(p.state.w, p.state.d) * 0.6;
        minX = Math.min(minX, p.x - radius); maxX = Math.max(maxX, p.x + radius);
        minZ = Math.min(minZ, p.z - radius); maxZ = Math.max(maxZ, p.z + radius);
        maxH = Math.max(maxH, p.state.h);
      }
      return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: Math.max(80, maxX - minX), d: Math.max(80, maxZ - minZ), h: maxH };
    };

    const b1 = wingBounds(w1), b2 = wingBounds(w2);
    // Subtle bias towards the corner so return wing remains visible in perspective
    const turn1 = Math.atan2(Math.sin(bisector - w1.meanAngle), Math.cos(bisector - w1.meanAngle)) * 0.35;
    const turn2 = Math.atan2(Math.sin(bisector - w2.meanAngle), Math.cos(bisector - w2.meanAngle)) * 0.35;

    return [
      { view: 'front' as const, az: bisector, el: 0.18, target: [bounds.x, targetY, bounds.z] as [number, number, number], bounds },
      { view: 'left' as const, az: w1.meanAngle + turn1, el: 0.14, target: [b1.x, Math.min(145, b1.h * 0.48), b1.z] as [number, number, number], bounds: b1 },
      { view: 'right' as const, az: w2.meanAngle + turn2, el: 0.14, target: [b2.x, Math.min(145, b2.h * 0.48), b2.z] as [number, number, number], bounds: b2 },
    ];
  }

  // Single straight or parallel run:
  const baseAngle = wings[0]!.meanAngle;
  return [
    { view: 'front' as const, az: baseAngle, el: 0.12, target: [bounds.x, targetY, bounds.z] as [number, number, number], bounds },
    { view: 'left' as const, az: baseAngle - 0.48, el: 0.22, target: [bounds.x, targetY, bounds.z] as [number, number, number], bounds },
    { view: 'right' as const, az: baseAngle + 0.48, el: 0.22, target: [bounds.x, targetY, bounds.z] as [number, number, number], bounds },
  ];
}

/** Environment- and furniture-aware reference views, rendered off screen. */
export function captureDesignReferences(ports: CapturePorts): DesignReferenceImage[] {
  const { renderer, scene, camera, document, bounds, fit, design } = ports;
  if (renderer.getContext().isContextLost()) throw new DesignImageUserError('CAPTURE_FAILED');
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
    if (!context) throw new DesignImageUserError('CAPTURE_FAILED');
    studio.sync(design.studio, design.wardrobes.map(w => ({ x: w.x, z: w.z, angle: w.angle, w: w.state.w, d: w.state.d })));
    const shots = planCameraShots(design.wardrobes, bounds);
    return shots.map(shotPlan => {
      const { view, az, el, target: shotTarget, bounds: shotBounds } = shotPlan;
      const distance = fit(shotBounds, az, el, 4 / 3) * 1.1;
      const shot = camera.clone();
      shot.clearViewOffset(); shot.aspect = 4 / 3; shot.zoom = 1;
      shot.near = Math.max(1, Math.min(50, distance * .005));
      shot.position.set(
        shotTarget[0] + distance * Math.cos(el) * Math.sin(az),
        shotTarget[1] + distance * Math.sin(el),
        shotTarget[2] + distance * Math.cos(el) * Math.cos(az)
      );
      shot.lookAt(shotTarget[0], shotTarget[1], shotTarget[2]);
      shot.updateProjectionMatrix(); shot.updateMatrixWorld(true);
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
      return {
        view, mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', .9).split(',')[1]!, width: 1440, height: 1080,
        camera: { position: shot.position.toArray(), target: shotTarget, fov: shot.fov }
      };
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
