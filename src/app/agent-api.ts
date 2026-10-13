import { buildFromSpec } from '../application/spec/build-from-spec';
import { describeScene, type SceneReport } from '../application/spec/describe-scene';
import type { EditorScene } from '../application/projects/editor-scene';
import type { ProjectDocument } from '../domain/project/project';
import type { DesignSpec, SpecProblem } from '../domain/spec/design-spec';
import { designSpecJsonSchema, parseDesignSpec } from '../infrastructure/serialization/design-spec-codec';
import { STUDIO_TEMPLATES } from '../domain/studio/studio-templates';
import { CEILING_SHAPES } from '../domain/studio/studio-ceiling';
import { SHAPE_TEMPLATES } from '../domain/wardrobe/shape/shape-templates';
import { POSSESSIONS } from '../domain/wardrobe/possessions';

/**
 * The editor's welcome for AI agents. A browser agent can read the guide (`help()`, also /llms.txt), call
 * functions on `window.wardrobeForge`, use the same functions as WebMCP tools where the browser offers them,
 * or open a design from a link (`#spec=`). Every design goes through the spec codec and the interpreter, so
 * an agent gets exactly what the editor's own commands build, and the person can undo it in one step.
 */
export type AgentResult = { ok: true; report: SceneReport; shown?: false; link?: string; note?: string } | { ok: false; problems: readonly SpecProblem[] };
export interface MountedEditor {
  replaceDesign(project: ProjectDocument): void;
  scene(): EditorScene;
  notify(message: string): void;
}

/** A spec an agent can start from: the space under a turning staircase, with a wardrobe filling its wall. */
export const EXAMPLE_SPEC: DesignSpec = {
  specVersion: 1, name: 'Under the stairs',
  room: { width: 380, depth: 115, height: 260, openings: [{ wall: 4, kind: 'door', width: 80 }] },
  ceilings: [{ wall: 1, shape: 'landing', points: [[95, 205], [185, 205], [320, 105], [380, 105]] }],
  wardrobes: [{ against: 1, fill: true, for: { short: 20, pants: 10 } }],
};

/** A small design and the link path that opens it, for assistants that cannot run JavaScript. */
export const LINK_EXAMPLE: DesignSpec = { specVersion: 1, room: { template: 'bedroom' }, wardrobes: [{ against: 1, width: 240, for: { short: 30, shoes: 10 } }] };
export const LINK_EXAMPLE_PATH = '/#spec=' + encodeURIComponent(JSON.stringify(LINK_EXAMPLE));

/** The spec in a design link: JSON as written (URL-encoded or not), or base64url JSON (what `link()` makes). */
export function specFromLink(hash: string): unknown {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('spec');
  if (!value) return null;
  const text = value.trim();
  return JSON.parse(text.startsWith('{') ? text : fromBase64Url(text));
}

const list = (items: readonly { id: string; description: string }[]) => items.map(t => `- \`${t.id}\`: ${t.description}`).join('\n');

/** The guide, with every allowed name read from the registries. */
export function agentGuide(): string {
  return `# Wardrobe Forge: guide for AI agents

Design a room and fitted wardrobes for a person by describing the result as a design spec (JSON).
The editor builds it with its own rules and reports back what it built, so you can check and adjust.

## In a chat, without running JavaScript: give the person a link
1. Write the design spec as JSON (conventions, names and an example below).
2. Give the person this site's address followed by \`#spec=\` and the JSON, URL-encoded (encodeURIComponent).
   They open it and see the design built, with every measurement. If something cannot be built, the page says
   what and why; ask them for that message and fix the spec.

Example, a 240 cm wardrobe in a bedroom for 30 shirts and 10 pairs of shoes:
\`${LINK_EXAMPLE_PATH}\`

## Functions (\`window.wardrobeForge\`, and the same as WebMCP tools where the browser offers them)
- \`help()\`: this guide.
- \`schema()\`: the JSON Schema of a design spec, every field described.
- \`example()\`: a complete spec to start from.
- \`check(spec)\`: builds it without changing the editor. Returns \`{ ok: true, report }\` or \`{ ok: false, problems }\`.
- \`build(spec)\`: builds it and shows it in the editor (the person can undo it in one step). Same result.
  In a browser without 3D (WebGL) nothing is shown: the result has \`shown: false\` and a \`link\` for the person.
- \`describe()\`: the report of the design the editor shows now (without 3D, of the last design built).
- \`link(spec)\`: a URL that opens this design in the editor; give it to the person.

Without JavaScript, give a link instead (above): \`#spec=\` with the JSON, URL-encoded, or base64url as \`link(spec)\` makes.

## How to work
1. Gather the measurements: the room's inside width and depth and wall height; doors and windows (which wall,
   width, distance from the wall's left end); stairs, landings, sloped ceilings or boxes coming down (which
   wall, heights at points along it); and what the person wants to store, with counts.
2. Write a spec, \`check\` it, fix every problem (each has a \`path\` and says what to do), then \`build\` it.
3. Read the report: gaps, what each wardrobe holds of what was asked, warnings. Adjust and build again.

## Conventions
- Centimetres. Walls are numbered from 1: 1 is the back (the wardrobe wall), 2 right, 3 front, 4 left.
- "from" along a wall is measured inside the room from the wall's left end, as you face the wall.
- A wardrobe \`against\` a wall fills its free stretch unless you give a \`width\` (and \`from\` to place it).
  Under stairs or a slope it takes the ceiling's shape. \`for\` plans its fittings with Auto design.

## Names
Built-in rooms (\`room.template\`):
${list(STUDIO_TEMPLATES)}

Ceiling shapes (\`ceilings[].shape\`):
${list(CEILING_SHAPES)}

Wardrobe tops (\`wardrobes[].shape\`):
${list(SHAPE_TEMPLATES)}

What wardrobes hold (\`wardrobes[].for\`, counts):
${POSSESSIONS.map(p => `- \`${p.key}\`: ${p.label}`).join('\n')}

## Example
\`\`\`json
${JSON.stringify(EXAMPLE_SPEC, null, 2)}
\`\`\`
`;
}

/** Checks and builds a spec without touching the editor. */
export function checkSpec(value: unknown): { result: AgentResult; project?: ProjectDocument } {
  let spec: DesignSpec;
  try { spec = parseDesignSpec(value); } catch (e) {
    return { result: { ok: false, problems: String((e as Error).message).split('\n').map(line => ({ path: line.split(':')[0]!, message: line.slice(line.indexOf(':') + 1).trim() })) } };
  }
  const built = buildFromSpec(spec, 'agent-' + Date.now().toString(36));
  return built.ok ? { result: { ok: true, report: built.report }, project: built.project } : { result: { ok: false, problems: built.problems } };
}

const toBase64Url = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const fromBase64Url = (code: string) => new TextDecoder().decode(Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

/** Why a browser without 3D shows no design, and what an agent does instead. */
export const NO_EDITOR_NOTE = 'This browser cannot show the 3D editor (WebGL is off), so nothing was shown. The design builds: give the person this link to open in their own browser.';

/**
 * The functions on `window.wardrobeForge`, and the WebMCP tools where the browser offers them. They work
 * before the editor starts and in a browser that cannot start it (agents' browsers often have no WebGL):
 * then `build` shows nothing and answers with a link for the person, and `describe` reports the last build.
 */
export function createAgentApi(current: () => MountedEditor | null, location: { href: string }) {
  let last: SceneReport | null = null;
  const api = {
    version: 1,
    help: agentGuide,
    schema: designSpecJsonSchema,
    example: () => structuredClone(EXAMPLE_SPEC),
    check: (spec: unknown) => checkSpec(spec).result,
    build(spec: unknown): AgentResult {
      const { result, project } = checkSpec(spec), editor = current();
      if (!project || !result.ok) return result;
      last = result.report;
      if (!editor) return { ...result, shown: false, link: api.link(spec), note: NO_EDITOR_NOTE };
      editor.replaceDesign(project);
      editor.notify('Design built by an assistant. Undo restores yours.');
      return result;
    },
    describe(): SceneReport | null {
      const editor = current();
      return editor ? describeScene(editor.scene()) : last;
    },
    link(spec: unknown) {
      const url = new URL(location.href);
      url.hash = 'spec=' + toBase64Url(JSON.stringify(spec));
      return url.toString();
    },
  };
  return Object.freeze(api);
}

type ToolContext = { registerTool(tool: { name: string; description: string; inputSchema: object; execute(input: unknown): Promise<unknown> }): unknown };
/** Offers the functions as WebMCP tools when the browser has them (an experimental API, so detected, never assumed). */
export function registerWebMcpTools(api: ReturnType<typeof createAgentApi>, doc: unknown, nav: unknown) {
  const context = ((doc as { modelContext?: ToolContext }).modelContext ?? (nav as { modelContext?: ToolContext }).modelContext);
  if (!context?.registerTool) return false;
  const reply = (value: unknown) => Promise.resolve({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] });
  const spec = designSpecJsonSchema() as object, none = { type: 'object', properties: {} };
  const tools = [
    { name: 'design_guide', description: 'How to design a room and wardrobes in Wardrobe Forge: functions, conventions, allowed names, an example.', inputSchema: none, execute: () => reply(api.help()) },
    { name: 'check_design', description: 'Builds a design spec without changing the editor; returns the report or every problem with its path.', inputSchema: spec, execute: (input: unknown) => reply(api.check(input)) },
    { name: 'build_design', description: 'Builds a design spec and shows it in the editor (the person can undo it); returns the report or the problems.', inputSchema: spec, execute: (input: unknown) => reply(api.build(input)) },
    { name: 'describe_design', description: 'Reports the design the editor shows now: walls, ceilings, wardrobes, gaps, what they hold, warnings.', inputSchema: none, execute: () => reply(api.describe()) },
    { name: 'design_link', description: 'A URL that opens a design spec in the editor.', inputSchema: spec, execute: (input: unknown) => reply(api.link(input)) },
  ];
  try { for (const tool of tools) context.registerTool(tool); return true; } catch { return false; }
}
