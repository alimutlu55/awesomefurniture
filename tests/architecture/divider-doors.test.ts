import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { createEditorState } from '../../src/application/projects/editor-state';
import type { EditorState } from '../../src/application/projects/editor-scene';
import { cabinetDoorAreas } from '../../src/domain/wardrobe/door-layout';
import { PANEL, PLINTH } from '../../src/domain/wardrobe/catalog.js';
import { sectionWidths } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { renderCabinetDoors } from '../../src/presentation/viewport/door-renderer';

function design(): EditorState {
    return Object.assign(createEditorState(), { w: 200, h: 230, n: 1, wt: [1], secs: [[]], dividers: [], doors: 'hinged' as const, open: false });
}
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-5, `${a} ≈ ${b}`);

test('a full-height divider creates two leaves with a seam at the board centre', () => {
    const s = design(), width = sectionWidths(s)[0]!;
    s.dividers = [{ i: 0, orientation: 'vertical', x: width / 2, y0: 0, y1: 230 - PLINTH - 2 * PANEL }];
    const areas = cabinetDoorAreas(s, [width]);
    assert.equal(areas.length, 2);
    close(areas[0]!.x1, 100 - .1);
    close(areas[1]!.x0, 100 + .1);
    // Moving, removing and duplicating the board derive a fresh layout, without stored door state.
    s.dividers[0]!.x = 60;
    close(cabinetDoorAreas(s, [width])[0]!.x1, PANEL + 60 - .1);
    s.dividers.push({ ...s.dividers[0]!, x: 130 });
    assert.equal(cabinetDoorAreas(s, [width]).length, 3);
    s.dividers = [];
    assert.equal(cabinetDoorAreas(s, [width]).length, 1);
});

test('section boundaries and unequal divider bays both determine doors; fittings do not', () => {
    const s = Object.assign(design(), { n: 2, wt: [1, 2], secs: [[{ k: 'shelf' as const, h: 60 }], []] });
    const widths = sectionWidths(s);
    s.dividers = [{ i: 1, orientation: 'vertical', x: 40, y0: 0, y1: 300 }];
    const areas = cabinetDoorAreas(s, widths);
    assert.equal(areas.length, 3);
    close(areas[1]!.x1, 2 * PANEL + widths[0]! + 40 - .1);
    s.dividers[0]!.y1 = 100;
    assert.equal(cabinetDoorAreas(s, widths).length, 2, 'partial free-standing boards do not split a full front');
});

test('nested structural divisions split only the enclosed compartment, independent of board order', () => {
    const s = design(), width = sectionWidths(s)[0]!, y = 100;
    s.dividers = [
        { i: 0, orientation: 'vertical', x: 60, y0: 0, y1: y - PANEL / 2 },
        { i: 0, orientation: 'horizontal', x0: 0, x1: width, y },
    ];
    const areas = cabinetDoorAreas(s, [width]);
    assert.equal(areas.length, 3);
    close(areas[0]!.y1, PLINTH + PANEL + y - .1);
    close(areas[2]!.y0, PLINTH + PANEL + y + .1);
    s.dividers.reverse();
    assert.deepEqual(cabinetDoorAreas(s, [width]), areas);
});

test('roof-clamped dividers still split doors under slopes and rear ceiling constraints', () => {
    const s = design(), width = sectionWidths(s)[0]!;
    s.shape = { template: 'sloped', top: [{ x: 0, y: 140 }, { x: 200, y: 230 }], back: [130, 220] };
    s.dividers = [{ i: 0, orientation: 'vertical', x: width / 2, y0: 0, y1: 170, want: 230 }];
    assert.equal(cabinetDoorAreas(s, [width]).length, 2);
});

test('hinged and glass leaves render separately, with opposing hinges and working open state', () => {
    const s = design(), widths = sectionWidths(s), material = new MeshBasicMaterial();
    s.dividers = [{ i: 0, orientation: 'vertical', x: widths[0]! / 2, y0: 0, y1: 300 }];
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: MeshBasicMaterial, g?: Group) => {
        const mesh = new Mesh(new BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); g?.add(mesh); return mesh;
    };
    for (const doors of ['hinged', 'glass', 'none'] as const) {
        s.doors = doors;
        for (const open of [false, true]) {
            s.open = open;
            const group = new Group(), pivots = renderCabinetDoors(s, widths, group, box as never, () => { throw Error('Flat doors should be boxes'); }, { M: () => material } as never, material, material);
            assert.equal(pivots.length, doors === 'none' ? 0 : 2);
            if (doors === 'none') continue;
            assert.ok(pivots[0]!.position.x < 0 && pivots[1]!.position.x > 0);
            close(pivots[0]!.rotation.y, open ? -1.6 : 0);
            close(pivots[1]!.rotation.y, open ? 1.6 : 0);
            const left = pivots[0]!.children[0] as Mesh, right = pivots[1]!.children[0] as Mesh;
            left.geometry.computeBoundingBox(); right.geometry.computeBoundingBox();
            close(pivots[0]!.position.x + left.position.x + left.geometry.boundingBox!.max.x, -.1);
            close(pivots[1]!.position.x + right.position.x + right.geometry.boundingBox!.min.x, .1);
        }
    }
});
