import * as THREE from 'three';
import type { EditorScene } from '../../application/projects/editor-scene';
import { DESIGN_REFERENCE_WIDTH, DESIGN_REFERENCE_HEIGHT, DESIGN_REFERENCE_JPEG_QUALITY, type DesignReferenceImage } from '../../application/projects/design-image';
import { createStudioRenderer } from './studio-renderer';
import { DesignImageUserError } from '../ai/design-image-errors';
import { designReferenceCameras } from './design-reference-camera';
import { neutralReferenceMaterials } from './design-reference-materials';

interface CapturePorts {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; document: Document;
  groups: readonly THREE.Object3D[]; ground: THREE.Object3D;
  settling: readonly { group: THREE.Object3D }[];
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

/** Environment- and furniture-aware reference views, rendered off screen. */
export function captureDesignReferences(ports: CapturePorts): DesignReferenceImage[] {
  const { renderer, scene, document, design } = ports;
  const width = DESIGN_REFERENCE_WIDTH, height = DESIGN_REFERENCE_HEIGHT;
  if (renderer.getContext().isContextLost()) throw new DesignImageUserError('CAPTURE_FAILED');
  const photo = new THREE.Scene();
  const subject = new THREE.Group();
  photo.add(subject);
  const settling = new Set(ports.settling.map(entry => entry.group));
  for (const group of ports.groups) {
    const clone = photoGeometry(group, settling);
    clone.visible = true; // Include furniture hidden by selection occlusion.
    subject.add(clone);
  }
  const kitchen = scene.getObjectByName('kitchen-runs');
  if (kitchen) subject.add(photoGeometry(kitchen));
  if (ports.ground.visible) photo.add(photoGeometry(ports.ground));
  const studio = createStudioRenderer(photo);
  // r128 defaults offscreen targets to 16-bit depth. At room-scale distances this
  // makes nearby backs, walls and shading planes fight, producing diagonal stripes.
  // A depth/stencil attachment uses 24-bit depth on both render-target paths.
  const target = renderer.capabilities.isWebGL2
    ? new THREE.WebGLMultisampleRenderTarget(width, height, { stencilBuffer: true })
    : new THREE.WebGLRenderTarget(width, height, { stencilBuffer: true });
  target.texture.encoding = THREE.sRGBEncoding;
  const previousTarget = renderer.getRenderTarget();
  const previousShadows = renderer.shadowMap.enabled;
  const previousToneMapping = renderer.toneMapping, previousExposure = renderer.toneMappingExposure;
  let neutral: ReturnType<typeof neutralReferenceMaterials> | undefined;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  const pixels = new Uint8Array(width * height * 4);
  try {
    if (!context) throw new DesignImageUserError('CAPTURE_FAILED');
    studio.sync(design.studio, design.wardrobes.map(w => ({ x: w.x, z: w.z, angle: w.angle, w: w.state.w, d: w.state.d })));
    neutral = neutralReferenceMaterials(photo);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
    const shots = designReferenceCameras(subject, design.wardrobes, design.studio);
    return shots.map(({ view, camera: shot, target: shotTarget }) => {
      studio.frame(shot, 100); // Resolve room cutaways for this camera, with no selection or animation.
      photo.traverse(object => { if (object instanceof THREE.Line && !object.userData.referenceEdge) object.visible = false; });
      renderer.setRenderTarget(target);
      renderer.render(photo, shot);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const frame = context.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        frame.data.set(pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
      }
      context.putImageData(frame, 0, 0);
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#e7e1d6'; context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'source-over';
      return {
        view, mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', DESIGN_REFERENCE_JPEG_QUALITY).split(',')[1]!, width, height,
        camera: { position: shot.position.toArray(), target: shotTarget, fov: shot.fov }
      };
    });
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.shadowMap.enabled = previousShadows;
    renderer.toneMapping = previousToneMapping; renderer.toneMappingExposure = previousExposure;
    neutral?.dispose();
    target.dispose(); studio.dispose();
    photo.clear();
    renderer.shadowMap.needsUpdate = true;
  }
}
