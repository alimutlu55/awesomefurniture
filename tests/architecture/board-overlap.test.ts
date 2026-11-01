import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { generateDesignedLayouts } from '../../src/domain/planner/wardrobe-composer';
import { createFromTemplate } from '../../src/domain/wardrobe/shape/shape-templates';
import { maxHeight, type ShapeTemplateId } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { cabinetBoards, type Board } from '../../src/domain/drawings/cabinet-boards';
import { createKitchenDesign, KITCHEN_PRESETS } from '../../src/domain/kitchen/kitchen-design';
import { KITCHEN_UNITS } from '../../src/domain/kitchen/kitchen-units';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

// No board passes through another: every board of a piece, as it is cut and drawn, only touches its neighbours. Boards
// are their true shape (a sloped top or a side cut to it by its outline), extruded through their depth.

type P = { x: number; y: number };
const outline = (b: Board): P[] => b.outline ? b.outline.map(p => ({ x: p.x, y: p.y }))
  : [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
const signedArea = (q: readonly P[]) => q.reduce((s, p, i) => { const r = q[(i + 1) % q.length]!; return s + p.x * r.y - r.x * p.y; }, 0) / 2;
const anticlockwise = (q: P[]) => signedArea(q) < 0 ? [...q].reverse() : q;
/** The part of `subject` inside `clipper` (both convex), front view. */
function common(subject: P[], clipper: P[]): P[] {
  let out = anticlockwise(subject);
  const c = anticlockwise(clipper);
  for (let i = 0; i < c.length && out.length; i++) {
    const A = c[i]!, B = c[(i + 1) % c.length]!, inside = (p: P) => (B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x) >= -1e-9;
    const cut = (p: P, q: P): P => {
      const a1 = B.y - A.y, b1 = A.x - B.x, c1 = a1 * A.x + b1 * A.y, a2 = q.y - p.y, b2 = p.x - q.x, c2 = a2 * p.x + b2 * p.y, det = a1 * b2 - a2 * b1;
      return { x: (b2 * c1 - b1 * c2) / det, y: (a1 * c2 - a2 * c1) / det };
    };
    const input = out;
    out = [];
    input.forEach((p, k) => { const q = input[(k + 1) % input.length]!; if (inside(q)) { if (!inside(p)) out.push(cut(p, q)); out.push(q); } else if (inside(p)) out.push(cut(p, q)); });
  }
  return out;
}
/** Every pair of boards that run into each other by more than half a millimetre each way. */
export function clashes(boards: readonly Board[]): string[] {
  const out: string[] = [];
  boards.forEach((a, i) => boards.slice(i + 1).forEach(b => {
    const deep = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
    if (deep <= .05) return;
    const q = common(outline(a), outline(b));
    if (q.length < 3 || Math.abs(signedArea(q)) < .05) return;
    const xs = q.map(p => p.x), ys = q.map(p => p.y), wide = Math.max(...xs) - Math.min(...xs), high = Math.max(...ys) - Math.min(...ys);
    if (wide > .05 && high > .05) out.push(`${a.name} and ${b.name} by ${wide.toFixed(1)} × ${high.toFixed(1)} × ${deep.toFixed(1)} cm at x ${Math.min(...xs).toFixed(1)}, y ${Math.min(...ys).toFixed(1)}`);
  }));
  return out;
}

const assertClear = (design: EditorDesign, name: string) => assert.deepEqual(clashes(cabinetBoards(design)), [], `${name}: boards run into each other`);
type State = ReturnType<typeof createEditorState>;
function wardrobe(w: number, h: number, extra: (s: State) => void = () => {}) {
  const s = createEditorState();
  s.w = w; s.h = h;
  extra(s);
  return s;
}
const shaped = (template: ShapeTemplateId) => (s: State) => {
  const start = createFromTemplate(template, { w: s.w, h: s.h, maxN: 6 });
  Object.assign(s, { shape: start.shape, n: start.n, wt: start.wt, h: maxHeight(start.shape) });
};
const NEEDS = [{}, { short: 40, long: 4, pants: 6, folded: 10, shoes: 4, small: 6 }, { short: 6, long: 14, folded: 40, shoes: 16, handbags: 6 }];

test('Auto design never puts one board through another, as designed or resized afterwards', () => {
  let designs = 0;
  for (const [w, h] of [[110, 210], [260, 245]] as const) for (const [n, needs] of NEEDS.entries()) for (const upper of ['fill', 'none']) {
    const make = () => wardrobe(w, h, s => { Object.assign(s.profile, { upper }); s.profile.needs = { ...s.profile.needs, ...needs } as never; });
    const proposals = generateDesignedLayouts(createWardrobeGeometry(() => make()).plannerConfig());
    proposals.forEach((p, k) => {
      for (const [axis, by] of [['w', 0], ['h', -30], ['w', 40]] as const) {
        const s = make();
        createDesignCommands(() => s).applyProposal(p as never);
        if (by) createSceneCommands(() => ({ wardrobes: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, state: s }], activeWardrobe: 1, nextWardrobeId: 2 }) as never).setCabinetSize(axis, (s[axis] ?? 0) + by);
        assertClear(s, `${w} × ${h}, needs ${n}, upper ${upper}, proposal ${k} (${p.title})${by ? `, then ${axis} ${by > 0 ? '+' : ''}${by}` : ''}`);
        designs++;
      }
    });
  }
  assert.ok(designs > 80, `${designs} designs checked`);
});

test('a sloped or stepped wardrobe, as Auto design fills it, has no board through another', () => {
  for (const template of ['sloped', 'stepped'] as const) for (const w of [120, 220]) {
    const make = () => wardrobe(w, 240, shaped(template));
    generateDesignedLayouts(createWardrobeGeometry(() => make()).plannerConfig()).forEach((p, k) => {
      const s = make();
      createDesignCommands(() => s).applyProposal(p as never);
      assertClear(s, `${template} ${w}, proposal ${k}`);
    });
  }
});

test('every kitchen unit and preset is built without one board through another', () => {
  // A sink, hob or wall shelf is bought or one board: it has no carcass (pieceBoards).
  for (const unit of KITCHEN_UNITS.filter(u => !('fixture' in u && u.fixture))) assertClear({ ...createEditorState(), ...createKitchenDesign(unit.key) } as EditorDesign, `kitchen ${unit.key}`);
  const bought = new Set(KITCHEN_UNITS.filter(u => 'fixture' in u && u.fixture).map(u => u.key as string));
  for (const preset of KITCHEN_PRESETS.filter(p => !bought.has(p.unit))) assertClear({ ...createEditorState(), ...createKitchenDesign(preset.unit, preset.key) } as EditorDesign, `kitchen preset ${preset.key}`);
});

test('a drawer\'s own front closes over the boards beside it rather than into them', () => {
  const s = wardrobe(100, 200, d => { d.secs = [[{ k: 'drawer', h: 23 } as never, { k: 'drawer', h: 23 } as never, { k: 'shelf', h: 30 } as never]]; d.n = 1; d.wt = [1]; });
  const boards = cabinetBoards(s), fronts = boards.filter(b => b.name === 'Drawer front'), shelves = boards.filter(b => b.name === 'Shelf');
  assert.ok(fronts.length === 2 && shelves.length > 0);
  for (const f of fronts) for (const sh of shelves.filter(b => b.y1 > f.y0 && b.y0 < f.y1)) assert.ok(sh.z1 <= f.z0 + 1e-9, 'a board beside a drawer front stops behind it');
  assert.deepEqual(clashes(boards), []);
});
