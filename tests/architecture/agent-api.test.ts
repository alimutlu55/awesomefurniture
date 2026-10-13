import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAMPLE_SPEC, agentGuide, checkSpec, createAgentApi, fromBase64Url, registerWebMcpTools } from '../../src/app/agent-api';
import { STUDIO_TEMPLATES } from '../../src/domain/studio/studio-templates';
import { CEILING_SHAPES } from '../../src/domain/studio/studio-ceiling';
import { POSSESSION_KEYS } from '../../src/domain/wardrobe/possessions';
import type { EditorScene } from '../../src/application/projects/editor-scene';
import type { ProjectDocument } from '../../src/domain/project/project';

/** The welcome for AI agents: the guide, window.wardrobeForge, WebMCP tools and design links. */

function editor() {
  const loaded: ProjectDocument[] = [], said: string[] = [];
  const scene: EditorScene = { wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1 };
  return { loaded, said, replaceDesign: (p: ProjectDocument) => { loaded.push(p); }, scene: () => scene, notify: (m: string) => { said.push(m); } };
}

test('public/llms.txt is the guide the page gives: regenerate with npm run agents:guide', () => {
  assert.equal(readFileSync('public/llms.txt', 'utf8'), agentGuide());
});

test('the guide names every built-in room, ceiling shape and possession, and its example builds', () => {
  const guide = agentGuide();
  for (const name of [...STUDIO_TEMPLATES.map(t => t.id), ...CEILING_SHAPES.map(c => c.id), ...POSSESSION_KEYS]) assert.ok(guide.includes('`' + name + '`'), name);
  assert.equal(checkSpec(EXAMPLE_SPEC).result.ok, true);
});

test('check builds without changing the editor; build shows it as one undo step and says so', () => {
  const e = editor(), api = createAgentApi(e, { href: 'https://example.test/editor' });
  assert.equal(api.check(api.example()).ok, true);
  assert.equal(e.loaded.length, 0, 'check leaves the editor alone');
  const built = api.build(api.example());
  assert.ok(built.ok && built.report.wardrobes[0]!.width === 380);
  assert.equal(e.loaded.length, 1);
  assert.match(e.said[0]!, /Undo restores yours/);
  const bad = api.build({ specVersion: 1, wardrobes: [{ against: 3 }] });
  assert.equal(bad.ok, false);
  assert.ok(!bad.ok && bad.problems[0]!.path.startsWith('wardrobes'), JSON.stringify(bad));
  assert.equal(e.loaded.length, 1, 'nothing is shown for a spec that cannot be built');
  assert.equal(api.check({ room: {} }).ok, false, 'a malformed spec is a problem, not an exception');
});

test('a design link carries the spec and opens the same design', () => {
  const api = createAgentApi(editor(), { href: 'https://example.test/editor?x=1#old' });
  const url = new URL(api.link(EXAMPLE_SPEC));
  assert.equal(url.pathname, '/editor');
  const spec = JSON.parse(fromBase64Url(new URLSearchParams(url.hash.slice(1)).get('spec')!));
  assert.deepEqual(spec, EXAMPLE_SPEC);
});

test('where the browser offers WebMCP, the functions are tools; elsewhere nothing is assumed', async () => {
  const tools: { name: string; execute(input: unknown): Promise<any> }[] = [];
  const api = createAgentApi(editor(), { href: 'https://example.test/' });
  assert.equal(registerWebMcpTools(api, { modelContext: { registerTool: (t: never) => tools.push(t) } }, {}), true);
  assert.deepEqual(tools.map(t => t.name), ['design_guide', 'check_design', 'build_design', 'describe_design', 'design_link']);
  const reply = await tools.find(t => t.name === 'check_design')!.execute(EXAMPLE_SPEC);
  assert.equal(JSON.parse(reply.content[0].text).ok, true);
  assert.equal(registerWebMcpTools(api, {}, {}), false);
});
