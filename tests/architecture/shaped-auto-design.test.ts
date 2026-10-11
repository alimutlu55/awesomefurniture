import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createFromTemplate } from '../../src/domain/wardrobe/shape/shape-templates';
import { maxHeight, type ShapeTemplateId } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { generateDesignedLayouts } from '../../src/domain/planner/wardrobe-composer';
import { WardrobePlanner } from '../../src/domain/planner/wardrobe-planner.js';

/** Auto design for a shaped wardrobe plans under its top, so the idea a person picks is exactly
 * what they get: same fittings, nothing cut or moved, and the capacity the idea promised. */

function shaped(template: ShapeTemplateId) {
  const state = createEditorState(), start = createFromTemplate(template, { w: state.w, h: state.h, maxN: 6 });
  Object.assign(state, { shape: start.shape, n: start.n, wt: start.wt, h: maxHeight(start.shape) });
  const geometry = createWardrobeGeometry(() => state), messages: string[] = [];
  return { state, geometry, messages, commands: createDesignCommands(() => state, { report: m => messages.push(m) }) };
}
const contents = (secs: readonly (readonly { k: string; h: number; purpose?: string | undefined }[])[]) =>
  secs.map(s => s.map(it => `${it.k}/${it.purpose}/${it.h}`));

for (const template of ['sloped', 'stepped', 'under-stairs', 'alcove'] as const) {
  test(`shaped Auto design · ${template}: the chosen idea is applied as it is, under the top`, () => {
    const { state, geometry, messages, commands } = shaped(template);
    const outline = JSON.stringify(geometry.shapeInfo().shape.top);
    const cfg = geometry.plannerConfig(), ideas = generateDesignedLayouts(cfg);
    assert.ok(ideas.length > 0, 'there are ideas for this shape');
    const idea = ideas[0]!;
    commands.applyProposal(idea as never);
    const applied = state.secs.slice(0, state.n);
    assert.deepEqual(contents(applied), contents(idea.sections.map(s => s.items)), 'the wardrobe holds exactly the chosen idea');
    assert.equal(JSON.stringify(geometry.shapeInfo().shape.top), outline, 'the wardrobe outline (and its steps) does not move');
    for (let i = 0; i < state.n; i++) {
      assert.ok(geometry.overflow(i) <= .05, `bay ${i + 1}: nothing reaches above the top`);
      state.secs[i]!.forEach((_, j) => assert.equal(geometry.fittingFit(i, j)?.cut, false, `bay ${i + 1}, fitting ${j + 1}: not cut by the top`));
    }
    assert.ok(!messages.some(m => /no longer fit|removed/i.test(m)), 'nothing had to be removed: ' + messages.join(' | '));
    const widths = geometry.widths();
    const holds = WardrobePlanner.analyze(applied.map((items, i) => ({ width: widths[i]!, items })), { ...cfg, shape: undefined }).coverage.total ?? 0;
    const promised = idea.metrics.coverage.total ?? 0;
    assert.ok(Math.abs(holds - promised) < .005, `it holds what the idea promised (${holds} vs ${promised})`);
  });
}

test('a rectangular wardrobe plans as before: no shape and no fixed bays in its planner settings', () => {
  const state = createEditorState(), cfg = createWardrobeGeometry(() => state).plannerConfig() as Record<string, unknown>;
  assert.equal(cfg.shape, undefined);
  assert.equal(cfg.bayWidths, undefined);
});
