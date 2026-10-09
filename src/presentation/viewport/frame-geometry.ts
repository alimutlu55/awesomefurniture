import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import type { Material, Object3D } from 'three';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
export type BoxBuilder = (w: number, h: number, d: number, x: number, y: number, z: number, material: Material, group?: Object3D) => Object3D;
export function renderCabinetFrame(design: Pick<EditorDesign, 'w' | 'h' | 'd'>, box: BoxBuilder, materials: {
    panel: Material;
    back: Material;
    plinth: Material;
}): void {
    const { w, h, d } = design;
    box(PANEL, h, d, -w / 2 + PANEL / 2, h / 2, 0, materials.panel);
    box(PANEL, h, d, w / 2 - PANEL / 2, h / 2, 0, materials.panel);
    box(w, PANEL, d, 0, h - PANEL / 2, 0, materials.panel);
    box(w - 2 * PANEL, PANEL, d - 1, 0, PLINTH + PANEL / 2, 0, materials.panel);
    box(w - 2 * PANEL, h - PLINTH - PANEL, .6, 0, (PLINTH + h - PANEL) / 2, -d / 2 + .3, materials.back);
    box(w - 2 * PANEL, PLINTH, d - 6, 0, PLINTH / 2, -1, materials.plinth);
}
