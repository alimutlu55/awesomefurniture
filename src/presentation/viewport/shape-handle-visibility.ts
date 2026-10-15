import type { Camera, Object3D } from 'three';
import type { ShapeSide } from '../../domain/wardrobe/shape/shape-handle-edit';

/** Show one editable edge, like the ceiling profile. Orbiting reveals the rear;
 * a captured point stays visible and the other controls step aside. */
export function shapeHandleVisible(el: HTMLElement, owner: Object3D | undefined, camera: Camera,
    drag: { index: number; side: ShapeSide } | null): boolean {
    if (!el.matches('.shape-handle[data-side]')) return true;
    if (drag) return el.classList.contains('point') && Number(el.dataset.index) === drag.index && el.dataset.side === drag.side;
    const side = owner && owner.worldToLocal(camera.position.clone()).z < 0 ? 'rear' : 'front';
    return el.dataset.side === side;
}
