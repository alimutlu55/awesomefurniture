// Local reference only: no saved/cloud design is read or modified.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { installationDrawingFixture } from './installation-drawing-fixture.mjs';
import { drawingInputOf } from '../src/presentation/drawings/drawing-release.ts';
import { technicalDrawings } from '../src/domain/drawings/technical-drawings.ts';
import { sheetPresentation, releaseStamp } from '../src/presentation/drawings/sheet-marks.ts';
import { marksToSvg } from '../src/presentation/drawings/paper-marks.ts';
import { marksToPdf } from '../src/presentation/drawings/pdf-writer.ts';
import { PAPER } from '../src/presentation/drawings/sheet-layout.ts';
import { projectToScene } from '../src/application/projects/editor-mapper.ts';
import { installedCorners } from '../src/domain/drawings/corner-joints.ts';
import { placePieces } from '../src/domain/drawings/room-pieces.ts';
import { validateForManufacture } from '../src/domain/drawings/manufacturing-validation.ts';

const [source, output = 'output/corner-conventions'] = process.argv.slice(2);
await mkdir(output, { recursive: true });
const scene = source ? projectToScene(JSON.parse(await readFile(source, 'utf8'))) : installationDrawingFixture();
const input = drawingInputOf(scene), joint = installedCorners(placePieces(input)).find(j => j.blind);
assert.ok(joint, 'reference needs a blind corner');
const wallIndex = scene.studio.walls.findIndex(w => w.id === joint.owner.wall);
const all = technicalDrawings(input, { preset: 'installation' });
const samples = all.filter(s => s.title === 'Plan' || s.title === 'Elevation ' + String.fromCharCode(65 + wallIndex) || s.title.startsWith('Corner '));
assert.equal(samples.length, 3);
const pages = samples.map((s, i) => ({ ...s, number: i + 1 }));
const info = { project: source ? 'Saved kitchen - corner representation' : 'Corner construction - reference example', date: '2026-10-28', total: pages.length };
const validation = validateForManufacture(input);
const stamp = releaseStamp({ ready: validation.ready, revision: validation.revision,
  blocking: validation.findings.filter(f => f.severity === 'critical').length });
for (const sheet of pages) {
  const presentation = sheetPresentation(sheet, info);
  assert.deepEqual(presentation.warnings, [], sheet.title + ' annotation layout');
  for (const [i, a] of presentation.dimensionBoxes.entries()) for (const b of presentation.dimensionBoxes.slice(i + 1))
    assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, sheet.title + ' overlapping figures');
  const name = sheet.title === 'Plan' ? 'plan' : sheet.title.startsWith('Corner ') ? 'corner-detail' : 'elevation';
  await writeFile(output + '/' + name + '.svg', marksToSvg([...presentation.marks, ...stamp], PAPER, String(sheet.number), sheet.title));
}
await writeFile(output + '/corner-reference.pdf', marksToPdf(pages.map(s => [...sheetPresentation(s, info).marks, ...stamp]), PAPER, info.project));
console.log('Reference elevation and enlarged corner detail verified: ' + output + '/corner-reference.pdf');
