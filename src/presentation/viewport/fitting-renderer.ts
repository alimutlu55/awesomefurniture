import { packStorageBoxes,storageBoxSize } from '../../domain/planner/storage-boxes';
import { shelfPossession, unitsOnShelf } from '../../domain/wardrobe/possessions';
import * as THREE from 'three';
import type { EditorItem } from '../../domain/wardrobe/editor-design';
import type { EditorState } from '../../application/projects/editor-scene';
import { FIN, PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { COL } from '../editor/editor-format.js';
import { GARMENT_COLOURS } from './fabric';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import type { createViewportResources } from './viewport-resources.js';
import type { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import type { BoxBuilder } from './frame-geometry';
interface FittingRendererPorts {
    resources: Pick<ReturnType<typeof createViewportResources>, 'M' | 'wood' | 'shade'> & Partial<Pick<ReturnType<typeof createViewportResources>, 'fabric'>>;
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
/** A fitting meeting a sloped or stepped top. Coordinates are cabinet-centred x and floor-relative y. */
export interface FittingCut {
    /** Working core in the fitting's own x (0 at its left edge) and its height. */
    core: { x0: number; x1: number; h: number };
    /** Box builder that cuts the box's front outline to the top. */
    slab: BoxBuilder;
    /** Lowest clear height over an x span. */
    clearAt(x0: number, x1: number): number;
}
export function createFittingRenderer({ resources, mp, md, h, box, d, mh, group, getRenderDesign, garment }: FittingRendererPorts) {
    /** Woven cloth for folded clothes, or a plain material where no cloth is provided (renderer tests). */
    const cloth = (color: string) => resources.fabric ? resources.fabric(color) : resources.M(color);
    /** `cut` is present when the fitting meets a sloped or stepped top: boards and
     * fronts go through `slab`, which cuts them to the angle; working parts use
     * the core rectangle; shelf contents that would touch the top are left out. */
    function mod(it: EditorItem, cx: number, y: number, sw: number, _supported = true, _capped = false, topSpans = [{x0:0,x1:sw}], bottomSpans = [{x0:0,x1:sw}], support = [{x0:0,x1:sw,rise:y>PLINTH+PANEL+.05?PANEL:0}], ceiling = h - PANEL, cut?: FittingCut) {
        const k = it.k, hh = it.h, fc2 = it.f ? FIN[it.f][0] : null, P = fc2 ? resources.wood(fc2) : mp, D = fc2 ? resources.wood(resources.shade(fc2, .92)) : md;
        const slab: BoxBuilder = cut ? cut.slab : box;
        // Working core: the full fitting unless the top cuts into it.
        const coreX = cut ? cx - sw / 2 + (cut.core.x0 + cut.core.x1) / 2 : cx, coreW = cut ? cut.core.x1 - cut.core.x0 : sw, coreH = cut ? cut.core.h : hh;
        const clears = (x0: number, x1: number, top: number) => !cut || top <= cut.clearAt(x0, x1) + .01;
        const deck = () => {
            if (y + hh >= ceiling - .05) {
                return;
            }
            for (const span of topSpans) slab(span.x1-span.x0, PANEL, d - 2, cx-sw/2+(span.x0+span.x1)/2, y + hh - PANEL / 2, -.5, P);
        };
        deck();
        if(y>PLINTH+PANEL+.05)for(const span of bottomSpans)slab(span.x1-span.x0,PANEL,d-2,cx-sw/2+(span.x0+span.x1)/2,y+PANEL/2,-.5,P);
        const riseAt=(x0=0,x1=sw)=>Math.max(0,...support.filter(span=>span.x1>x0+.01&&span.x0<x1-.01).map(span=>span.rise));
        const base=y+riseAt();
        if (k === 'drawer' || k === 'sdrawer') {
            // An angled front over a rectangular drawer box that runs on standard slides.
            slab(sw - .4, hh - 1, PANEL, cx, y + hh / 2, d / 2 - 1.2, P);
            box(Math.max(4, coreW - 3), Math.max(4, coreH - 6), d - 8, coreX, y + coreH / 2 - 1, -2, D);
            box(Math.min(14, coreW * .4), 1, 1.4, coreX, y + Math.min(coreH, hh) / 2, d / 2 + .4, mh);
        }
        else if (['shelf', 'folded', 'seasonal', 'shoe', 'basket'].includes(k)) {
            if (k === 'shoe') {
                const pairs = Math.max(1, WardrobePlanner.geo.shoePairs(sw)), sh = Math.min(9, hh - PANEL - 1);
                for (let j = 0; j < pairs; j++) {
                    for (let q = 0; q < 2; q++) {
                        const px = cx - (pairs - 1) * WardrobePlanner.geo.shoeW() / 2 + j * WardrobePlanner.geo.shoeW() + (q ? 5 : -5);
                        if (!clears(px - 4, px + 4, base + sh)) continue;
                        box(8, sh, Math.min(27, d - 5), px, base + sh / 2, 1, cloth(GARMENT_COLOURS[j % 8]!));
                    }
                }
            }
            else if (k === 'shelf' && shelfPossession(it.purpose ?? '')) {
                // A possession that stands upright on the shelf, drawn at the size its registry entry gives.
                const held = shelfPossession(it.purpose ?? '')!, { unit, pitch } = { unit: held.holder.unit, pitch: held.holder.pitch };
                const unitD = Math.min(unit.depth, d - 6), count = unitsOnShelf(held.holder, sw);
                const fits = hh >= unit.height + 2;
                for (let j = 0; j < count && fits; j++) {
                    const bx = cx - (count - 1) * pitch / 2 + j * pitch;
                    box(unit.width, unit.height, unitD, bx, base + unit.height / 2, 0, resources.M(COL[(j * 2) % 8]!));
                    if (unit.handle) box(unit.width * .45, 1, 1.2, bx, base + unit.height + .5, 0, mh);
                }
            }
            else if (k === 'folded' || (k === 'shelf' && ['folded', 'pants'].includes(it.purpose ?? ''))) {
                const stacks = WardrobePlanner.geo.foldStacks(sw, false), layers = Math.min(5, Math.floor((hh - 5) / 4)), fw = Math.min(23, sw - 4);
                for (let j = 0; j < stacks; j++) {
                    const px = cx - (stacks - 1) * WardrobePlanner.geo.foldW() / 2 + j * WardrobePlanner.geo.foldW();
                    for (let q = 0; q < layers; q++) {
                        if (!clears(px - fw / 2, px + fw / 2, base + 3.2 + q * 3.5)) break;
                        box(fw, 3.2, Math.min(30, d - 5), px, base + 1.6 + q * 3.5, 2, cloth(GARMENT_COLOURS[(j * 2 + q) % 8]!));
                    }
                }
            }
            else if (k === 'seasonal' || ['seasonal', 'linen', 'luggage'].includes(it.purpose ?? '')) {
                const size=storageBoxSize(getRenderDesign().profile);
                const count=it.boxes??packStorageBoxes(sw,d,0,size).capacity;
                const packing=packStorageBoxes(sw,d,count,size);
                for(const position of packing.positions){
                    const bx=cx+position.x,bz=position.z;
                    const rise=riseAt(sw/2+position.x-size.width/2,sw/2+position.x+size.width/2);
                    if(size.height>hh-PANEL-rise+.01)continue;
                    if(!clears(bx-size.width/2,bx+size.width/2,y+rise+size.height))continue;
                    box(size.width,size.height,size.depth,bx,y+rise+size.height/2,bz,resources.M('#b7aa91'));
                    box(Math.min(9,size.width-4),4,.3,bx,y+rise+size.height*.55,bz+size.depth/2+.3,resources.M('#f3eee4'));
                }
            }
            else if (k === 'basket') {
                const bh = Math.min(coreH - 5, 32);
                box(Math.max(4, coreW - 6), bh, d - 9, coreX, base + bh / 2, 0, resources.M('#8d99ae', { wireframe: true }));
                box(Math.max(4, coreW - 7), 2, 2, coreX, y + coreH - 7, d / 2 - 3, mh);
            }
        }
        else if (k === 'void') {
        }
        else if (k === 'pants') {
            const count = Math.max(1, WardrobePlanner.geo.pantsCount(coreW));
            box(Math.max(4, coreW - 5), 1.5, d - 8, coreX, y + coreH - 7, -1, mh);
            for (let j = 0; j < count; j++) {
                const px = coreX - (count - 1) * 3 + j * 6;
                box(1, 1, Math.min(d - 10, 40), px, y + coreH - 9, 0, mh);
                box(2, Math.min(coreH - 14, 60), Math.min(d - 15, 28), px, y + (coreH - 14) / 2 + 2, 0, cloth(GARMENT_COLOURS[j % 8]!));
            }
        }
        else {
            // Rails hang only across the part of the fitting where garments clear the top.
            const ry = y + coreH - 6, front = !!it.front, len = front ? d - 8 : Math.max(4, coreW - 3), r = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, len, 12), mh);
            r.rotation[front ? 'x' : 'z'] = Math.PI / 2;
            r.position.set(coreX, ry, 0);
            r.castShadow = true;
            group.add(r);
            const c = Math.max(1, WardrobePlanner.geo.hangCount(coreW, front, d, k)), sp = WardrobePlanner.geo.spacing(k), gh = Math.min(k === 'long' ? getRenderDesign().profile.longDrop : coreH - 12, coreH - 10, coreH - riseAt() - 9), gz = Math.min(d - 14, 42);
            for (let j = 0; j < c; j++) {
                const g = gh * (.92 + .08 * ((j * 7) % 5) / 4);
                if (front) {
                    garment(coreX, ry - 3, -(c - 1) * sp / 2 + j * sp, g, Math.min(coreW - 8, 42), GARMENT_COLOURS[(j * 3) % 8]!, true);
                }
                else {
                    garment(coreX - (c - 1) * sp / 2 + j * sp, ry - 3, 0, g, gz, GARMENT_COLOURS[(j * 3) % 8]!);
                }
            }
            if (k === 'lift') {
                [-1, 1].forEach(side => box(1.8, Math.min(45, coreH / 2), 2, coreX + side * (coreW / 2 - 4), ry - 20, 1, mh));
                box(1.2, Math.min(65, coreH - 12), 1.2, coreX, ry - Math.min(65, coreH - 12) / 2, d / 2 - 7, mh);
                box(12, 2, 2, coreX, ry - Math.min(65, coreH - 12), d / 2 - 7, mh);
            }
        }
    }
    return { mod };
}
