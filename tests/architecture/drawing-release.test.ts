import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseCurrent, releaseDrawings } from '../../src/presentation/drawings/drawing-release';
import { marksToPdf } from '../../src/presentation/drawings/pdf-writer';
import { pdfHex } from '../../src/presentation/drawings/helvetica-metrics';
import { listFindings } from '../../src/domain/drawings/manufacturing-validation';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { cuttingList } from '../../src/domain/drawings/cutting-list';
import { createEditorState } from '../../src/application/projects/editor-state';
import type { EditorScene } from '../../src/application/projects/editor-scene';
import type { Mark } from '../../src/presentation/drawings/paper-marks';

/** Fail-closed export: the drawing set says whether it may be used for manufacture, on every sheet. */

const scene = (x2: number): EditorScene => ({ activeWardrobe: 1, nextWardrobeId: 3, wardrobes: [
  { id: 1, name: 'W1', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() },
  { id: 2, name: 'W2', x: x2, y: 0, z: 0, angle: 0, state: createEditorState() }] });
const texts = (marks: readonly Mark[]) => marks.flatMap(m => m.kind === 'text' ? [m.text] : []);

test('a set with a clash is NOT FOR MANUFACTURE on every sheet, ends with the Manufacturing check, and its PDF says so', () => {
  const r = releaseDrawings(scene(80), 'Wardrobe design', '24/10/2026');
  assert.equal(r.validation.ready, false);
  assert.equal(r.pages.length, r.marks.length);
  assert.equal(r.info.total, r.pages.length, 'every sheet is numbered n of the real total');
  assert.ok(r.marks.every(m => texts(m).includes('NOT FOR MANUFACTURE')), 'stamped on every sheet');
  const check = r.pages.at(-1)!;
  assert.equal(check.title, 'Manufacturing check');
  assert.ok(check.table!.rows.some(row => row[0] === 'BLOCKING' && /W1 and W2/.test(row[2]!)), JSON.stringify(check.table!.rows));
  assert.ok(r.marks.every(m => texts(m).some(t => t.includes(r.validation.revision))), 'every title block names the model revision');
  const pdf = Buffer.from(marksToPdf(r.marks, { w: 420, h: 297 }, 'test')).toString('latin1');
  // Text is written as hex glyph codes.
  assert.ok(pdf.includes(pdfHex('NOT FOR MANUFACTURE')), 'the saved file carries the stamp');
});

test('a sound set is released for manufacture against its revision, and goes stale when the model changes', () => {
  const s = scene(260), r = releaseDrawings(s, 'Wardrobe design', '24/10/2026');
  assert.equal(r.validation.ready, true, JSON.stringify(r.validation.findings.filter(f => f.severity === 'critical')));
  assert.ok(r.marks.every(m => !texts(m).includes('NOT FOR MANUFACTURE')));
  assert.ok(texts(r.marks[0]!).includes('For manufacture · revision ' + r.validation.revision));
  assert.equal(r.pages.at(-1)!.table!.rows[0]![0], 'Passed');
  assert.equal(releaseCurrent(r, s), true);
  s.wardrobes[1]!.x += 1;
  assert.equal(releaseCurrent(r, s), false, 'an edit after the set was made makes it stale');
});

test('a cutting list that misses or doubles a board is caught, part by part', () => {
  const pieces = placePieces({ pieces: [{ id: 1, name: 'W1', x: 0, y: 0, z: 0, angle: 0, design: createEditorState() }] });
  const list = cuttingList(pieces);
  assert.deepEqual(listFindings(pieces, list), []);
  const side = list[0]!.rows.findIndex(r => r[1] === 'Side');
  const missing = [{ ...list[0]!, rows: list[0]!.rows.filter((_, i) => i !== side) }, ...list.slice(1)];
  assert.deepEqual(listFindings(pieces, missing).map(f => f.id), ['list:W1:Side']);
  const doubled = [{ ...list[0]!, rows: list[0]!.rows.map((r, i) => i === side ? [r[0]!, r[1]!, String(Number(r[2]) * 2), ...r.slice(3)] : r) }, ...list.slice(1)];
  assert.match(listFindings(pieces, doubled)[0]!.message, /Side/);
});
