import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doorSheets, doorHolePoint } from '../../src/domain/drawings/door-sheet';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { placePieces, type DrawingInput } from '../../src/domain/drawings/room-pieces';
import { flatHoles } from '../../src/domain/make/make-assembly';
import { makePiece } from '../../src/domain/make/make-parts';
import type { Item, P } from '../../src/domain/drawings/drawing';
import { goldenWardrobes } from './rule-fixtures';

/** Door sheets (P1-14): every kind of door leaf drawn with its hinge cups and handle holes where Make drills them. */

const centre = (points: readonly P[]) => ({ x: points.reduce((s, q) => s + q.x, 0) / points.length, y: points.reduce((s, q) => s + q.y, 0) / points.length });
/** The holes drawn on a sheet: its closed 16-point circles, by centre. */
const drawnHoles = (items: readonly Item[]) => items.filter(i => i.kind === 'line' && i.closed && i.points.length === 16).map(i => centre((i as { points: readonly P[] }).points));
const key = (q: P) => Math.round(q.x * 10) / 10 + ',' + Math.round(q.y * 10) / 10;

test('every door of every golden wardrobe with doors has a sheet, its holes where Make drills them', () => {
  for (const [name, design] of goldenWardrobes()) {
    const input: DrawingInput = { pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: { ...design, doors: 'hinged' } }] };
    const made = makePiece(input, 1)!, sheets = doorSheets(input, placePieces(input));
    const doors = made.parts.filter(p => p.stock === 'door');
    assert.ok(doors.length > 0, name);
    assert.equal(sheets.length, doors.length, `${name}: one sheet per kind of door`);
    doors.forEach((part, k) => {
      const id = part.ids[0]!, holes = flatHoles(made.boards[id]!, made.holes.filter(h => h.board === id)).filter(h => h.kind === 'cup' || h.kind === 'handle');
      const drawn = drawnHoles(sheets[k]!.views[0]!.items).map(key).sort(), made_ = holes.map(h => key(doorHolePoint(h))).sort();
      assert.ok(holes.some(h => h.kind === 'cup'), `${name} door ${part.n}: has cups`);
      assert.deepEqual(drawn, made_, `${name} door ${part.n}: the sheet's holes are Make's`);
      // The cups are dimensioned up from the bottom end.
      const chain = sheets[k]!.views[0]!.items.find(i => i.kind === 'dims' && i.dir.y === 1 && i.row === 1) as { stops: readonly number[] } | undefined;
      for (const h of holes.filter(h => h.kind === 'cup')) assert.ok(chain?.stops.includes(Math.round(h.u * 10) / 10), `${name} door ${part.n}: cup at ${h.u} dimensioned`);
    });
  }
});

test('the door sheets are in the drawing set, labelled as common practice', () => {
  const [, design] = goldenWardrobes()[0]!;
  const sheets = technicalDrawings({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: { ...design, doors: 'hinged' } }] });
  const doors = sheets.filter(s => / Door \d+$/.test(s.title));
  assert.ok(doors.length > 0);
  for (const s of doors) assert.match(s.legend!.join(' '), /common practice; check the maker's template/);
  const none = technicalDrawings({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: { ...design, doors: 'none' } }] });
  assert.equal(none.filter(s => / Door \d+$/.test(s.title)).length, 0, 'no doors, no door sheets');
});
