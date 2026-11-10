import * as THREE from 'three';

/** A pose as the editor's camera holds it: turned `az` round the target, raised `el`, `dist` away. */
export interface PrintPose { readonly az: number; readonly el: number; readonly dist: number; readonly x: number; readonly y: number; readonly z: number }

/**
 * A camera for a picture printed on the drawings, rendered off screen: never the editor's view camera, which only the
 * editor's camera controller moves. Placed as the editor places its own from a pose, with the editor's lens, seeing
 * one `layer`.
 */
export function printCamera(pose: PrintPose, aspect: number, layer: number, fov = 35): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 1, 50000);
  camera.layers.set(layer);
  camera.position.set(pose.x + pose.dist * Math.cos(pose.el) * Math.sin(pose.az), pose.y + pose.dist * Math.sin(pose.el), pose.z + pose.dist * Math.cos(pose.el) * Math.cos(pose.az));
  camera.lookAt(pose.x, pose.y, pose.z);
  camera.updateMatrixWorld(true);
  return camera;
}
