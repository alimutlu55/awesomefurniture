import type { createEditorDom } from '../editor/editor-dom';
import type { createCameraController } from './camera-controller';
import type { createCameraState } from './camera-state';
import type { studioCameraBounds } from './studio-layout';
interface StudioCameraPorts {
  dom: ReturnType<typeof createEditorDom>;
  camera: ReturnType<typeof createCameraController>;
  cameraState: ReturnType<typeof createCameraState>;
}
/** Fit the actual room into the space above the phone sheet or beside the desktop panel.
 * Moving the target keeps the camera projection and ground picking in the same coordinate frame. */
export function frameStudio({ dom, camera, cameraState }: StudioCameraPorts, bounds: ReturnType<typeof studioCameraBounds>, plan: boolean) {
  camera.camRelease();
  cameraState.initialCameraFraming = false;
  cameraState.vsT = cameraState.vs = 0; cameraState.vzT = cameraState.vz = 1;
  camera.applyView();
  const view = dom.$('#view').getBoundingClientRect(), panel = dom.$('#room-panel').getBoundingClientRect();
  const phone = dom.width <= 900, left = phone ? 26 : Math.max(30, panel.right - view.left + 26);
  const right = view.width - 26, top = phone ? 105 : 120;
  // Reserve the expanded sheet's space before selecting a wall, avoiding a camera jump mid-drag.
  const bottom = phone ? Math.max(top + 120, view.height * .62 - 90) : view.height - 80;
  const width = Math.max(140, right - left), height = Math.max(120, bottom - top);
  const az = plan ? 0 : .55, el = plan ? Math.PI / 2 - .01 : .65;
  const dist = camera.cameraFitDistance(bounds, az, el, width / height) * view.height / height * 1.1;
  const units = 2 * dist * Math.tan(35 * Math.PI / 360) / view.height;
  const horizontal = ((left + right) / 2 - view.width / 2) * units;
  const vertical = (view.height / 2 - (top + bottom) / 2) * units;
  camera.cameraFlyTo({ az, el, dist,
    x: bounds.x - Math.cos(az) * horizontal + Math.sin(el) * Math.sin(az) * vertical,
    y: bounds.h / 2 - Math.cos(el) * vertical,
    z: bounds.z + Math.sin(az) * horizontal + Math.sin(el) * Math.cos(az) * vertical,
  });
}
