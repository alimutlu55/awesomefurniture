// Local reference only: no saved/cloud design is read or modified.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { installationDrawingFixture } from './installation-drawing-fixture.mjs';
import { drawingInputOf } from '../src/presentation/drawings/drawing-release.ts';
import { technicalDrawings } from '../src/domain/drawings/technical-drawings.ts';
import { sheetPresentation, sheetSvg } from '../src/presentation/drawings/sheet-marks.ts';
import { marksToPdf } from '../src/presentation/drawings/pdf-writer.ts';
import { PAPER } from '../src/presentation/drawings/sheet-layout.ts';

const output = 'output/corner-conventions';
await mkdir(output, { recursive: true });
const all = technicalDrawings(drawingInputOf(installationDrawingFixture()), { preset: 'installation' });
const samples = all.filter(s => s.title === 'Elevation A' || s.title.startsWith('Corner '));
assert.equal(samples.length, 2);
const pages = samples.map((s, i) => ({ ...s, number: i + 1 }));
const info = { project: 'Corner construction - reference example', date: '2026-10-28', total: pages.length };
for (const sheet of pages) {
  const presentation = sheetPresentation(sheet, info);
  assert.deepEqual(presentation.warnings, [], sheet.title + ' annotation layout');
  for (const [i, a] of presentation.dimensionBoxes.entries()) for (const b of presentation.dimensionBoxes.slice(i + 1))
    assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, sheet.title + ' overlapping figures');
  await writeFile(output + '/' + (sheet.title.startsWith('Corner ') ? 'corner-detail' : 'elevation') + '.svg', sheetSvg(sheet, info));
}
await writeFile(output + '/corner-reference.pdf', marksToPdf(pages.map(s => sheetPresentation(s, info).marks), PAPER, info.project));
console.log('Reference elevation and enlarged corner detail verified: ' + output + '/corner-reference.pdf');
