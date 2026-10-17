import { isKitchen } from '../../domain/furniture/furniture';
import { kitchenAlong, unitAxes } from '../../domain/kitchen/kitchen-runs';
import { WORKTOP } from '../../domain/kitchen/kitchen-units';

interface FurnitureFramingPorts {
  readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene' | 'activeCabinet'>;
  readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'frameWardrobe' | 'frameBox'>>;
}

/** Shows the selected furniture: a wardrobe on its own, a kitchen cabinet with the kitchen along its wall, seen from
 * a little to the side and above, so a unit added to a run is seen where it joins the others. */
export function createFurnitureFraming({ model, camera }: FurnitureFramingPorts) {
  return {
    frame() {
      const unit = model.activeCabinet();
      if (!model.scene.wardrobes.length || !isKitchen(unit.state)) { camera.frameWardrobe(); return; }
      const xs: number[] = [], zs: number[] = [];
      let h = 0;
      for (const c of kitchenAlong(model.scene.wardrobes, unit)) {
        const { u, v } = unitAxes(c.angle);
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
          xs.push(c.x + u.x * a * c.state.w / 2 + v.x * b * c.state.d / 2);
          zs.push(c.z + u.z * a * c.state.w / 2 + v.z * b * c.state.d / 2);
        }
        h = Math.max(h, (c.y || 0) + c.state.h + WORKTOP.thickness);
      }
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      camera.frameBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h }, unit.angle * Math.PI / 180 + .18, .22, 1.15);
    },
  };
}
