import { Vector2 } from 'three';
import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';

interface PreviewBounds { x: number; z: number; w: number; d: number; h: number }
type FitDistance = (bounds: PreviewBounds, az: number, el: number, aspect: number) => number;

/** A canonical 4:3 overview, independent of the user's current zoom or portrait viewport. */
export function capturePreview(
  renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, document: Document,
  bounds: PreviewBounds, fit: FitDistance, facing: number,
): string | null {
  const size = renderer.getSize(new Vector2());
  try {
    const previewCamera = camera.clone(), az = facing + .32, el = .5;
    const distance = fit(bounds, az, el, 4 / 3) * 1.12;
    previewCamera.clearViewOffset(); previewCamera.aspect = 4 / 3; previewCamera.zoom = 1;
    previewCamera.near = Math.max(1, Math.min(50, distance * .005));
    previewCamera.position.set(
      bounds.x + distance * Math.cos(el) * Math.sin(az),
      bounds.h / 2 + distance * Math.sin(el),
      bounds.z + distance * Math.cos(el) * Math.cos(az),
    );
    previewCamera.lookAt(bounds.x, bounds.h / 2, bounds.z); previewCamera.updateProjectionMatrix();
    renderer.setSize(256, 192, false);
    renderer.render(scene, previewCamera);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 192;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#e7e1d6'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .72);
  } catch { return null; } // Preview failure must never prevent a design save.
  finally { renderer.setSize(size.x, size.y, false); }
}
