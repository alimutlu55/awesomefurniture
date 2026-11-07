import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import type { EditorScene } from '../../src/application/projects/editor-scene';
import { createEngineService } from '../../src/application/engine/engine-service';
import { applyFix } from '../../src/application/engine/engine-fixes';
import { diffScenes } from '../../src/domain/engine/scene-diff';
import type { EngineFinding } from '../../src/domain/engine/rules/engine-rules';

/** A scene with one 124 cm wardrobe of one bay: two shelves of bedding over a hanging rail, wider than a shelf may span. */
function scene(): EditorScene {
  const state = createEditorState();
  Object.assign(state, { w: 124, h: 220, d: 60, n: 1, wt: [1, 100, 100, 100, 100, 100],
    secs: [[{ k: 'shelf', h: 35, purpose: 'linen' }, { k: 'shelf', h: 35, purpose: 'linen' }, { k: 'short', h: 106 }], [], [], [], [], []], dividers: [] });
  return { wardrobes: [{ id: 1, name: 'Wardrobe 1', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 };
}

test('engine service · inspects when the design changes, not when only the selection does', () => {
  const events: string[] = [], s = scene();
  const service = createEngineService({ currency: () => 'pln', events: { track: name => events.push(name) }, now: () => 1 });
  assert.equal(service.refresh(s), true);
  assert.equal(service.refresh(s), false);
  s.wardrobes[0]!.state.sel = 0; s.wardrobes[0]!.state.item = 2; s.wardrobes[0]!.state.open = true;
  assert.equal(service.refresh(s), false, 'selecting a fitting or opening the doors is not a design change');
  s.wardrobes[0]!.state.d = 58;
  assert.equal(service.refresh(s), true);
  assert.deepEqual(service.history().map(h => h.changes.map(c => c.kind)), [['resized']]);
  assert.equal(service.current()!.quotes.length, 0, 'prices wait until they are asked for');
  assert.ok(service.quotes().length === 3 && service.quotes().every(q => q.currency === 'pln'));
  assert.equal(service.quotes(), service.quotes(), 'and are kept until the design changes');
  assert.ok(events.includes('design_changed') && events.includes('findings'));
});

test('engine fixes · splitting the bay keeps its layout on both sides and clears the span the check blocked on', () => {
  const s = scene(), service = createEngineService({ currency: () => 'eur' });
  const active = () => s.wardrobes.find(w => w.id === s.activeWardrobe)!.state, commands = createDesignCommands(active);
  service.refresh(s);
  const blocking = (): EngineFinding[] => service.current()!.evaluation.findings.filter(f => f.severity === 'blocking');
  const span = blocking().find(f => f.id.includes('shelf-span'))!, fix = span.fixes.find(f => f.action.kind === 'split-bay')!;
  const ok = applyFix(fix.action, { scene: () => s, select: id => { s.activeWardrobe = id; }, splitSelectedBay: () => commands.splitBay(),
    setConstruction: () => assert.fail('not this fix') });
  assert.ok(ok);
  assert.equal(active().n, 2, 'the bay is split in two');
  assert.deepEqual(active().secs.slice(0, 2).map(b => b.map(it => it.k)), [['shelf', 'shelf', 'short'], ['shelf', 'shelf', 'short']], 'each half keeps the layout');
  service.refresh(s);
  assert.deepEqual(blocking().filter(f => f.id.includes('shelf-span')), [], 'no shelf spans too far any more');
  assert.ok(service.history().at(-1)!.changes.some(c => c.kind === 'bays'));
});

test('engine fixes · a fix for a piece that is gone does nothing', () => {
  const s = scene();
  assert.equal(applyFix({ kind: 'split-bay', piece: 99, bay: 0 }, { scene: () => s, select: () => assert.fail(), splitSelectedBay: () => assert.fail(), setConstruction: () => assert.fail() }), false);
});

test('scene diff · says what changed in a carpenter\'s words', () => {
  const a = scene(), b = scene(), d = b.wardrobes[0]!.state;
  d.w = 130; d.secs[0]!.push({ k: 'shelf', h: 30 }); d.fin = 'Walnut'; b.wardrobes[0]!.x = 20;
  const input = (s: EditorScene) => ({ pieces: s.wardrobes.map(w => ({ id: w.id, name: w.name, x: w.x, y: w.y, z: w.z, angle: w.angle, design: w.state })) });
  const changes = diffScenes(input(a), input(b));
  assert.deepEqual(changes.map(c => c.kind), ['moved', 'resized', 'interior', 'finish']);
  assert.match(changes[1]!.text, /width 124 cm → 130 cm/);
  assert.match(changes[2]!.text, /\+1 shelf/);
  assert.deepEqual(diffScenes(input(a), { pieces: [] }).map(c => c.kind), ['removed']);
});

test('bay split · a narrow fitting stays on its side; a split that cannot fit is refused with the reason', () => {
  const s = scene(), state = s.wardrobes[0]!.state, reports: string[] = [];
  state.secs[0] = [{ k: 'drawer', h: 20, w: 50, x: 0 }, { k: 'shelf', h: 35 }];
  const commands = createDesignCommands(() => state, { report: m => reports.push(m) });
  assert.ok(commands.splitBay());
  assert.deepEqual(state.secs.slice(0, 2).map(b => b.map(it => it.k)), [['drawer', 'shelf'], ['shelf']]);
  const narrow = scene().wardrobes[0]!.state;
  Object.assign(narrow, { w: 80, secs: [[{ k: 'short', h: 106 }], [], [], [], [], []] });
  const refused: string[] = [];
  assert.equal(createDesignCommands(() => narrow, { report: m => refused.push(m) }).splitBay(), false);
  assert.match(refused[0]!, /Short hang needs 45 cm/);
  assert.equal(narrow.n, 1);
});
