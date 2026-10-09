import { packStorageBoxes,storageBoxSize } from '../../domain/planner/storage-boxes';
import * as THREE from 'three';
import type { EditorItem } from '../../domain/wardrobe/editor-design';
import type { EditorState } from '../../application/projects/editor-scene';
import { FIN, PANEL } from '../../domain/wardrobe/catalog.js';
import { COL } from '../editor/editor-format.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import type { createViewportResources } from './viewport-resources.js';
import type { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import type { BoxBuilder } from './frame-geometry';
interface FittingRendererPorts {
    resources: Pick<ReturnType<typeof createViewportResources>, 'M' | 'wood' | 'shade'>;
    mp: THREE.Material;
    md: THREE.Material;
    mh: THREE.Material;
    h: number;
    d: number;
    box: BoxBuilder;
    geometry: Pick<ReturnType<typeof createWardrobeGeometry>, 'isBoxed'>;
    group: THREE.Group;
    getRenderDesign(): EditorState;
    garment(cx: number, top: number, z: number, height: number, depth: number, color: string, front?: boolean): void;
}
export function createFittingRenderer({ resources, mp, md, geometry, h, box, d, mh, group, getRenderDesign, garment }: FittingRendererPorts) {
    function mod(it: EditorItem, cx: number, y: number, sw: number, _supported = true, _capped = false) {
        const k = it.k, hh = it.h, fc2 = it.f ? FIN[it.f][0] : null, P = fc2 ? resources.wood(fc2) : mp, D = fc2 ? resources.wood(resources.shade(fc2, .92)) : md;
        const boxed = geometry.isBoxed(it), deck = () => {
            if (boxed && y + hh >= h - PANEL - .05) {
                return;
            }
            box(sw, PANEL, d - 2, cx, y + hh - PANEL / 2, -.5, P);
        }; // every fitting, boxes included, has its board on top, flush with the fitting's upper edge (the cabinet ceiling for the top fitting)
        if (k === 'drawer' || k === 'sdrawer') {
            box(sw - .4, hh - 1, PANEL, cx, y + hh / 2, d / 2 - 1.2, P);
            box(sw - 3, Math.max(4, hh - 6), d - 8, cx, y + hh / 2 - 1, -2, D);
            box(Math.min(14, sw * .4), 1, 1.4, cx, y + hh / 2, d / 2 + .4, mh);
        }
        else if (['shelf', 'folded', 'seasonal', 'shoe', 'basket'].includes(k)) {
            deck();
            if (k === 'shoe') {
                const pairs = Math.max(1, WardrobePlanner.geo.shoePairs(sw)), sh = Math.min(9, hh - PANEL - 1);
                for (let j = 0; j < pairs; j++) {
                    for (let q = 0; q < 2; q++) {
                        box(8, sh, Math.min(27, d - 5), cx - (pairs - 1) * WardrobePlanner.geo.shoeW() / 2 + j * WardrobePlanner.geo.shoeW() + (q ? 5 : -5), y + sh / 2, 1, resources.M(COL[j % 8]!));
                    }
                }
            }
            else if (k === 'folded' || (k === 'shelf' && ['folded', 'pants'].includes(it.purpose ?? ''))) {
                const stacks = WardrobePlanner.geo.foldStacks(sw, false), layers = Math.min(5, Math.floor((hh - 5) / 4));
                for (let j = 0; j < stacks; j++) {
                    for (let q = 0; q < layers; q++) {
                        box(Math.min(23, sw - 4), 3.2, Math.min(30, d - 5), cx - (stacks - 1) * WardrobePlanner.geo.foldW() / 2 + j * WardrobePlanner.geo.foldW(), y + 2 + q * 3.5, 2, resources.M(COL[(j * 2 + q) % 8]!));
                    }
                }
            }
            else if (k === 'seasonal' || ['seasonal', 'linen', 'luggage'].includes(it.purpose ?? '')) {
                const size=storageBoxSize(getRenderDesign().profile);
                const count=it.boxes??packStorageBoxes(sw,d,0,size).capacity;
                const packing=packStorageBoxes(sw,d,count,size);
                if(size.height>hh-PANEL) return;
                for(const position of packing.positions){
                    const bx=cx+position.x,bz=position.z;
                    box(size.width,size.height,size.depth,bx,y+size.height/2,bz,resources.M('#b7aa91'));
                    box(Math.min(9,size.width-4),4,.3,bx,y+size.height*.55,bz+size.depth/2+.3,resources.M('#f3eee4'));
                }
            }
            else if (k === 'basket') {
                box(sw - 6, Math.min(hh - 5, 32), d - 9, cx, y + Math.min(hh - 5, 32) / 2 + 1, 0, resources.M('#8d99ae', { wireframe: true }));
                box(sw - 7, 2, 2, cx, y + hh - 7, d / 2 - 3, mh);
            }
        }
        else if (k === 'void') {
            deck();
        }
        else if (k === 'pants') {
            deck();
            const count = Math.max(1, WardrobePlanner.geo.pantsCount(sw));
            box(sw - 5, 1.5, d - 8, cx, y + hh - 7, -1, mh);
            for (let j = 0; j < count; j++) {
                const px = cx - (count - 1) * 3 + j * 6;
                box(1, 1, Math.min(d - 10, 40), px, y + hh - 9, 0, mh);
                box(2, Math.min(hh - 14, 60), Math.min(d - 15, 28), px, y + (hh - 14) / 2 + 2, 0, resources.M(COL[j % 8]));
            }
        }
        else {
            deck();
            const ry = y + hh - 6, front = !!it.front, len = front ? d - 8 : sw - 3, r = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, len, 12), mh);
            r.rotation[front ? 'x' : 'z'] = Math.PI / 2;
            r.position.set(cx, ry, 0);
            r.castShadow = true;
            group.add(r);
            const c = Math.max(1, WardrobePlanner.geo.hangCount(sw, front, d, k)), sp = WardrobePlanner.geo.spacing(k), gh = Math.min(k === 'long' ? getRenderDesign().profile.longDrop : hh - 12, hh - 10), gz = Math.min(d - 14, 42);
            for (let j = 0; j < c; j++) {
                const g = gh * (.92 + .08 * ((j * 7) % 5) / 4);
                if (front) {
                    garment(cx, ry - 3, -(c - 1) * sp / 2 + j * sp, g, Math.min(sw - 8, 42), COL[(j * 3) % 8]!, true);
                }
                else {
                    garment(cx - (c - 1) * sp / 2 + j * sp, ry - 3, 0, g, gz, COL[(j * 3) % 8]!);
                }
            }
            if (k === 'lift') {
                [-1, 1].forEach(side => box(1.8, Math.min(45, hh / 2), 2, cx + side * (sw / 2 - 4), ry - 20, 1, mh));
                box(1.2, Math.min(65, hh - 12), 1.2, cx, ry - Math.min(65, hh - 12) / 2, d / 2 - 7, mh);
                box(12, 2, 2, cx, ry - Math.min(65, hh - 12), d / 2 - 7, mh);
            }
        }
    }
    return { mod };
}
