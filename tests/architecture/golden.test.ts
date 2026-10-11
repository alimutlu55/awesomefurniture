import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createFromTemplate } from '../../src/domain/wardrobe/shape/shape-templates';
import { maxHeight, type ShapeTemplateId } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { generateDesignedLayouts } from '../../src/domain/planner/wardrobe-composer';

/**
 * Golden tests: they lock what the app produces today, so a refactor that only moves code cannot
 * silently change behaviour. Each case is recorded in tests/fixtures/golden/<case>.json.
 *
 * A failure here means behaviour changed. If the change is intended, explain it in the commit and
 * re-record with:  UPDATE_GOLDEN=1 npm test
 */

const DIR = 'tests/fixtures/golden';
const UPDATE = process.env.UPDATE_GOLDEN === '1';

/** Rounds every number so last-digit floating point noise does not count as a change. */
function stable(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 1e4) / 1e4 : String(value);
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && typeof v !== 'function').map(([k, v]) => [k, stable(v)]));
  return value;
}

function golden(name: string, actual: unknown) {
  const file = `${DIR}/${name}.json`, data = stable(actual);
  if (UPDATE || !existsSync(file)) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
    if (!UPDATE) assert.fail(`${file} was missing and has been recorded. Review it, commit it, and run the tests again.`);
    return;
  }
  assert.deepEqual(data, JSON.parse(readFileSync(file, 'utf8')), `${name} changed. If intended, re-record with UPDATE_GOLDEN=1 npm test and explain why in the commit.`);
}

interface Case { template?: ShapeTemplateId; w?: number; accessible?: boolean; needs?: Record<string, number> }
const CASES: Record<string, Case> = {
  'regular-default': {},
  'regular-modest-handbags': { needs: { short: 14, long: 4, pants: 8, folded: 20, shoes: 6, small: 20, handbags: 6 } },
  'regular-accessible': { accessible: true },
  'regular-narrow': { w: 100 },
  'sloped-default': { template: 'sloped' },
  'stepped-default': { template: 'stepped' },
};

function design(c: Case) {
  const state = createEditorState();
  if (c.w) state.w = c.w;
  if (c.template) {
    const start = createFromTemplate(c.template, { w: state.w, h: state.h, maxN: 6 });
    Object.assign(state, { shape: start.shape, n: start.n, wt: start.wt, h: maxHeight(start.shape) });
  }
  if (c.accessible) Object.assign(state.profile, { accessible: true, reach: 122 });
  if (c.needs) state.profile.needs = { ...state.profile.needs, ...c.needs } as never;
  return state;
}

/** What a proposal is, without ids and timings: the layout, its score and what it holds. */
const proposal = (p: any) => ({
  title: p.title, score: p.score, complete: p.complete, cost: p.cost, coverage: p.coverage, held: p.held,
  capacities: p.metrics?.capacities, warnings: p.warnings,
  sections: p.sections.map((s: any) => ({ width: s.width, items: s.items.map((it: any) => ({ k: it.k, purpose: it.purpose, h: it.h, x: it.x, y: it.y, w: it.w, front: it.front, boxes: it.boxes })) })),
  dividers: p.dividers,
});

for (const [name, c] of Object.entries(CASES)) {
  test(`golden · Auto design proposals · ${name}`, () => {
    const state = design(c), geometry = createWardrobeGeometry(() => state);
    golden(`planner-${name}`, generateDesignedLayouts(geometry.plannerConfig()).map(proposal));
  });

  test(`golden · applied design: layout, cost, stats, Add item suggestions · ${name}`, () => {
    const state = design(c), geometry = createWardrobeGeometry(() => state), commands = createDesignCommands(() => state);
    const best = generateDesignedLayouts(geometry.plannerConfig())[0];
    if (best) commands.applyProposal(best as never);
    const sections = Array.from({ length: state.n }, (_, i) => i);
    golden(`design-${name}`, {
      n: state.n, wt: state.wt, secs: state.secs, dividers: state.dividers,
      layout: sections.map(i => geometry.computeLayout(i)),
      cost: geometry.cost(), stats: geometry.stats(),
      suggestions: sections.map(i => { state.sel = i; state.space = null; return geometry.addSuggestions(); }),
    });
  });
}
