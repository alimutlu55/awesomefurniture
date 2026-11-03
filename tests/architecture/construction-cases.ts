import { readFileSync, readdirSync } from 'node:fs';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createKitchenDesign, KITCHEN_PRESETS } from '../../src/domain/kitchen/kitchen-design';
import { KITCHEN_UNITS } from '../../src/domain/kitchen/kitchen-units';
import { createFromTemplate, SHAPE_TEMPLATES } from '../../src/domain/wardrobe/shape/shape-templates';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

export const constructionCases: [string, EditorDesign][] = [
  ['wardrobe', createInitialDesign()],
  ...KITCHEN_UNITS.map(u => [u.key, createKitchenDesign(u.key)] as [string, EditorDesign]),
  ...KITCHEN_PRESETS.map(p => ['preset-' + p.key, createKitchenDesign(p.unit, p.key)] as [string, EditorDesign]),
];
for (const template of SHAPE_TEMPLATES) for (const doors of ['none', 'hinged'] as const) {
  const base = createInitialDesign(), shape = createFromTemplate(template.id, { w: base.w, h: base.h, maxN: 6 });
  constructionCases.push([`shape-${template.id}-${doors}`, { ...base, ...shape, doors, secs: Array.from({length:6}, () => []) }]);
}
for (const file of readdirSync('tests/fixtures/golden').filter(f => f.startsWith('design-'))) {
  const data = JSON.parse(readFileSync('tests/fixtures/golden/' + file, 'utf8'));
  const base = createInitialDesign(), template = file.includes('sloped') ? 'sloped' : file.includes('stepped') ? 'stepped' : 'regular';
  const w = file.includes('narrow') ? 100 : base.w;
  const shape = createFromTemplate(template, { w, h: base.h, maxN: 6 });
  constructionCases.push([file, { ...base, w, shape: shape.shape, n: data.n, wt: data.wt, secs: data.secs, dividers: data.dividers }]);
}
