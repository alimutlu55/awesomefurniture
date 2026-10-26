// Render technical drawing artifacts from a local project copy. No cloud reads, writes or migrations.
// node --import tsx scripts/preview-kitchen-drawings.mjs project.json output/drawing-preview
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { projectToScene } from '../src/application/projects/editor-mapper.ts';
import { releaseDrawings } from '../src/presentation/drawings/drawing-release.ts';
import { marksToSvg } from '../src/presentation/drawings/paper-marks.ts';
import { marksToPdf } from '../src/presentation/drawings/pdf-writer.ts';

const [source, output = 'output/drawing-preview'] = process.argv.slice(2);
if (!source) throw new Error('Supply a local project JSON path. The source is never modified.');
const bytes = await readFile(source, 'utf8'), project = JSON.parse(bytes), scene = projectToScene(project);
if (!scene) throw new Error('Project has no editable scene.');
const before = structuredClone(scene), date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
const release = releaseDrawings(scene, project.name || 'Kitchen', date);
await mkdir(output, { recursive: true });
for (const [i, sheet] of release.pages.entries()) {
  const name = String(i + 1).padStart(2, '0') + '-' + sheet.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await writeFile(output + '/' + name + '.svg', marksToSvg(release.marks[i], { w: 420, h: 297 }, name, sheet.title));
}
await writeFile(output + '/technical-drawings.pdf', marksToPdf(release.marks, { w: 420, h: 297 }, project.name || 'Kitchen'));
await writeFile(output + '/validation.json', JSON.stringify(release.validation, null, 2));
assert.deepEqual(scene, before, 'generating drawings must not modify the scene');
assert.equal(await readFile(source, 'utf8'), bytes, 'source project must not change');
console.log(JSON.stringify({ pages: release.pages.length, ready: release.validation.ready, revision: release.validation.revision, sourceUnchanged: true }));
