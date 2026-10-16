import type { Camera, Object3D, Vector3 } from 'three';

export interface CanvasAddArea { left: Vector3; right: Vector3; bottom: Vector3; top: Vector3 }
interface Label {
    el: HTMLElement; owner?: Object3D; addArea?: CanvasAddArea; canvasScale?: number | undefined;
}
/** Keep the existing Add item pill proportional to its projected free space.
 * Its visual bounds, including border and padding, shrink together with the room. */
export function sizeCanvasAdd(label: Label, camera: Camera, view: { width: number; height: number }) {
    if (!label.addArea) return;
    const project = (point: Vector3) => {
        const p = point.clone(); label.owner?.localToWorld(p); p.project(camera);
        return { x: p.x * view.width / 2, y: p.y * view.height / 2 };
    };
    const { left, right, bottom, top } = label.addArea;
    const width = Math.abs(project(right).x - project(left).x), height = Math.abs(project(top).y - project(bottom).y);
    label.canvasScale = Math.max(0, Math.min(1, width * .55 / Math.max(1, label.el.offsetWidth), height * .25 / Math.max(1, label.el.offsetHeight)));
}
