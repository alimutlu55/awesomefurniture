import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { imageDesignSpecification } from '../../src/application/projects/image-design-specification';
import { IMAGE_VIEWS, type DesignImageRequest } from '../../src/application/projects/design-image';
import { handleDesignImage } from '../../src/infrastructure/gemini/design-image-handler';
import { MAX_REQUEST_BYTES, generatedImageData, imageData } from '../../src/infrastructure/gemini/design-image-contract';
import { modelSpecification } from '../../src/application/projects/design-image-model-specification';
import { photoGeometry } from '../../src/presentation/viewport/capture-design-references';
import worker from '../../src/app/worker';
import { requestDesignImage } from '../../src/presentation/ai/design-image-client';
import { designImageErrorMessage, DesignImageUserError } from '../../src/presentation/ai/design-image-errors';
import { buildSystemInstruction } from '../../src/infrastructure/gemini/design-image-prompt';
import { STYLE_PROMPTS } from '../../src/infrastructure/gemini/design-image-styles';
import { serializeConfigurationSummary } from '../../src/application/projects/configuration-summary';
import { defaultMaterials } from '../../src/domain/materials/configured-materials';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJxkAAAAASUVORK5CYII=';
function fixture(): DesignImageRequest {
  const built = buildFromSpec({ specVersion: 1, room: { width: 360, depth: 220, height: 260 },
    wardrobes: [{ against: 1, width: 180, height: 220, depth: 60, shape: 'sloped' }] }, 'private-project-id');
  assert.ok(built.ok);
  const scene = projectToScene(built.project)!;
  return { specification: imageDesignSpecification(scene), references: IMAGE_VIEWS.map(view => ({
    view, mimeType: 'image/jpeg', data: '/9j/2Q==', width: 1024, height: 768,
    camera: { position: [0, 180, 600], target: [0, 110, 0], fov: 35 },
  })) };
}
const environment = { GEMINI_API_KEY: 'test-server-secret', AI_RATE_LIMITER: { async limit() { return { success: true }; } } };
const request = (body: unknown = fixture(), headers: Record<string, string> = {}) => new Request('https://design.example/api/design-images', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://design.example', ...headers }, body: JSON.stringify(body),
});
const completed = () => Response.json({ status: 'completed', steps: [
  { type: 'thought', content: [{ type: 'text', text: 'not user output' }] },
  { type: 'model_output', content: [{ type: 'image', mime_type: 'image/png', data: png }] },
] });

test('image specification preserves resolved construction and room geometry without transient selection', () => {
  const input = fixture(), spec = input.specification, furniture = spec.design.furniture[0]!;
  assert.equal(spec.units, 'cm'); assert.equal(spec.construction.panelThickness, 1.8);
  assert.equal(furniture.dimensions.width, 180); assert.ok(furniture.shape);
  assert.ok(spec.design.studio?.walls.length); assert.ok(furniture.sections.length);
  assert.ok(spec.technicalDrawings.some(s => s.title === 'Cutting list'));
  assert.ok(spec.technicalDrawings.some(s => s.title === 'Hardware list'));
  assert.equal('editorLayout' in furniture, false);
  assert.equal(JSON.stringify(spec).includes('private-project-id'), false);
  assert.equal(spec.finishes.Oak!.color, '#b99a75');
});

test('server sends labeled references, active rules and a Tier 1 manifest with a server-only header', async () => {
  let calls = 0;
  const input = fixture();
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), environment.GEMINI_API_KEY);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'gemini-nano-banana-2.1'); assert.equal(body.store, false);
    assert.deepEqual(body.response_format, [{ type: 'text' }, { type: 'image', mime_type: 'image/jpeg', image_size: '2K', aspect_ratio: '4:3' }]);
    const imageFormat = body.response_format.find((format: { type: string }) => format.type === 'image');
    assert.equal('delivery' in imageFormat, false, 'Nano Banana 2.1 rejects an explicit image delivery mode');
    const [aspectWidth, aspectHeight] = imageFormat.aspect_ratio.split(':').map(Number);
    assert.equal(aspectWidth / aspectHeight, input.references[0]!.width / input.references[0]!.height, 'Output matches the reference aspect ratio');
    assert.equal(body.generation_config.thinking_level, 'high');
    const labels = body.input.filter((part: { type: string }) => part.type === 'text').slice(0, 3).map((part: { text: string }) => part.text);
    assert.match(labels[0], /Image 1 as the strict camera and TIER 1 structural reference/);
    assert.match(labels[0], /TIER 2 cleanup.*protruding floor-base strips.*truncated walls/);
    assert.match(labels[1], /Image 2 \(left supporting view\).*SAME design.*do not adopt its camera angle/);
    assert.match(labels[2], /Image 3 \(right supporting view\).*SAME design.*do not adopt its camera angle/);
    assert.equal(body.input.length, 7);
    assert.doesNotMatch(String(init?.body), /technicalDrawings|schemaVersion|camera:|Design specification/);
    assert.equal(body.input.filter((p: { type: string }) => p.type === 'image').length, 3);
    const prompt = body.system_instruction.replace(/\s+/g, ' ');
    assert.match(prompt, /^You are an elite Editorial Interior Photographer \(Architectural Digest editorial standard/);
    assert.match(prompt, /Phase One IQ4 medium-format camera with a 28–35mm tilt-shift lens/);
    assert.match(prompt, /Foreground Atmosphere \(Level 2\)/);
    assert.match(prompt, /TIER 1 — LOCKED/);
    assert.match(prompt, /customer-specified materials, colors, and finishes explicitly listed in the user prompt/);
    assert.match(prompt, /TIER 2 — ENHANCE & CLEAN UP/);
    assert.match(prompt, /natural bounce light/);
    assert.doesNotMatch(prompt, /Corona|V-Ray|STAGING_LEVEL|kitchen|backsplash|worktop|stone|espresso|counter stools|Level [13]|pendant|boudoir|\brug\b/i);
    const finalText = body.input.at(-1).text;
    assert.match(finalText, /Images 2 and 3 only for supporting details/);
    assert.match(finalText, /TIER 1 Locked Finishes.*Configured Finishes/);
    assert.match(finalText, /Carcass & Exterior Fronts \(Unified Decor\): Egger H1318 ST10/);
    assert.match(finalText, /TIER 1 Module Breakdown.*Wing\/Module Breakdown/);
    assert.match(finalText, /Wing\/module 1.*Bay 1/);
    assert.match(finalText, /TIER 2 Room Completion/);
    assert.doesNotMatch(finalText, /Walnut|Graphite|Sage/);
    assert.equal(String(init?.body).includes(environment.GEMINI_API_KEY), false);
    return completed();
  };
  const response = await handleDesignImage(request(input), environment, fetcher);
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { model: 'gemini-nano-banana-2.1', image: { mimeType: 'image/png', data: png } });
});

test('shuffled reference views retain numbered camera and detail roles at the provider boundary', async () => {
  const input = fixture();
  input.references.forEach(image => { image.data = Buffer.from(image.view).toString('base64'); });
  const [front, left, right] = input.references;
  input.references = [right!, front!, left!];
  let calls = 0;
  const response = await handleDesignImage(request(input), environment, async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    const parts = body.input.slice(0, 6);
    assert.deepEqual(parts.filter((part: { type: string }) => part.type === 'image').map((part: { data: string }) => Buffer.from(part.data, 'base64').toString()),
      ['front', 'left', 'right']);
    for (let index = 0; index < 3; index++) {
      assert.equal(parts[index * 2].type, 'text');
      assert.match(parts[index * 2].text, new RegExp(`Image ${index + 1}`));
      assert.equal(parts[index * 2 + 1].type, 'image');
    }
    return completed();
  });
  assert.equal(response.status, 200); assert.equal(calls, 1);
});

test('all render configurations prune inactive category, staging, LED and ceiling branches from the outgoing payload', async () => {
  for (const category of ['wardrobe', 'kitchen'] as const) for (const stagingLevel of [1, 2, 3] as const) {
    for (const hasIntegratedLed of [false, true]) for (const hasCeilingBulkhead of [false, true]) {
      const input = fixture();
      if (category === 'kitchen') input.specification.design.furniture = input.specification.design.furniture.map(piece => ({ ...piece, product: 'kitchen' }));
      input.renderConfig = { category, stagingLevel, hasIntegratedLed, hasCeilingBulkhead };
      let calls = 0;
      const response = await handleDesignImage(request(input), environment, async (_url, init) => {
        calls++;
        const body = JSON.parse(String(init?.body)), prompt = body.system_instruction;
        assert.equal(prompt, buildSystemInstruction(input.renderConfig!));
        assert.doesNotMatch(prompt, /Corona|V-Ray|STAGING_LEVEL|pendant|boudoir|counter stools/);
        for (const level of [1, 2, 3]) assert.equal(prompt.includes(`Level ${level}`), level === stagingLevel);
        assert.equal(/\brug\b/.test(prompt), stagingLevel === 3);
        assert.equal(prompt.includes('Concealed 2700K LED strips'), hasIntegratedLed);
        assert.equal(prompt.includes('natural bounce light'), !hasIntegratedLed);
        assert.equal(prompt.includes('flush bulkhead/fascia'), hasCeilingBulkhead);
        assert.equal(prompt.includes('preserving the open top clearance'), !hasCeilingBulkhead);
        if (category === 'wardrobe') assert.doesNotMatch(prompt, /kitchen|backsplash|worktop|espresso|stone/i);
        else {
          assert.match(prompt, /espresso machine.*backsplash.*worktops/);
          assert.doesNotMatch(prompt, /placeholder garments|tailored garments|knitwear|footwear/);
        }
        assert.match(body.input.at(-1).text, /TIER 1 Locked Finishes/);
        assert.match(body.input.at(-1).text, /TIER 1 Module Breakdown/);
        return completed();
      });
      assert.equal(response.status, 200, JSON.stringify(input.renderConfig));
      assert.equal(calls, 1);
    }
  }
});

test('studio and concept looks send their own instructions, labels and request, never the realistic photograph', async () => {
  for (const style of ['studio', 'concept'] as const) for (const category of ['wardrobe', 'kitchen'] as const) {
    for (const hasIntegratedLed of [false, true]) for (const hasCeilingBulkhead of [false, true]) {
      const prompts = new Set<string>();
      for (const stagingLevel of [1, 2, 3] as const) {
        const input = fixture();
        if (category === 'kitchen') input.specification.design.furniture = input.specification.design.furniture.map(piece => ({ ...piece, product: 'kitchen' }));
        input.renderConfig = { category, style, stagingLevel, hasIntegratedLed, hasCeilingBulkhead };
        let calls = 0;
        const response = await handleDesignImage(request(input), environment, async (_url, init) => {
          calls++;
          const body = JSON.parse(String(init?.body)), prompt: string = body.system_instruction.replace(/\s+/g, ' ');
          prompts.add(body.system_instruction);
          assert.equal(body.system_instruction, STYLE_PROMPTS[style].systemInstruction(input.renderConfig!));
          assert.notEqual(body.system_instruction, buildSystemInstruction({ ...input.renderConfig!, style: 'realistic' }));
          assert.doesNotMatch(prompt, /Architectural Digest|Phase One|Editorial Interior Photographer|Level [123]|\brug\b|oak flooring/);
          assert.match(prompt, /TIER 1 — LOCKED/);
          assert.match(prompt, /customer-specified materials, colors, and finishes explicitly listed in the user prompt/);
          assert.match(prompt, /protruding wall-base strips/);
          if (style === 'studio') {
            assert.match(prompt, /^You are a commercial furniture photographer/);
            assert.match(prompt, /high-key studio product photograph.*5000K neutral white/);
          } else {
            assert.match(prompt, /^You are an architectural illustrator/);
            assert.match(prompt, /ink linework with soft, translucent watercolor washes.*not a photograph or a CGI render/);
            assert.match(prompt, /No text, labels, dimensions/);
          }
          assert.equal(/LED strips (under|glow)|Show the concealed LED strips/.test(prompt), hasIntegratedLed);
          assert.equal(prompt.includes('flush bulkhead/fascia'), hasCeilingBulkhead);
          assert.equal(prompt.includes('open top clearance'), !hasCeilingBulkhead);
          if (category === 'wardrobe') assert.doesNotMatch(prompt, /kitchen|worktop|ceramics|bowls/i);
          else assert.doesNotMatch(prompt, /garments|hangers|folded stacks/);
          const labels: string[] = body.input.filter((part: { type: string }) => part.type === 'text').slice(0, 3).map((part: { text: string }) => part.text);
          assert.deepEqual(labels, IMAGE_VIEWS.map(view => STYLE_PROMPTS[style].referenceLabels[view]));
          const [front = '', left = ''] = labels;
          assert.match(front, /Image 1 as the strict camera and TIER 1 structural reference/);
          assert.match(front, style === 'studio' ? /minimal studio set/ : /fade softly into the white paper/);
          assert.match(left, /Image 2 \(left supporting view\).*SAME design.*do not adopt its camera angle/);
          const finalText: string = body.input.at(-1).text;
          assert.ok(finalText.startsWith(STYLE_PROMPTS[style].request) && finalText.endsWith(STYLE_PROMPTS[style].completion));
          assert.match(finalText, /TIER 1 Locked Finishes[\s\S]*TIER 1 Module Breakdown/);
          assert.doesNotMatch(finalText, /realistic 2K interior photograph|continuous oak flooring|directional off-camera daylight/);
          return completed();
        });
        assert.equal(response.status, 200, JSON.stringify(input.renderConfig));
        assert.equal(calls, 1);
      }
      assert.equal(prompts.size, 1, 'the staging level shapes only the realistic photograph');
    }
  }
});

test('the realistic look is the default when no style is sent', async () => {
  const bodies: string[] = [];
  for (const style of [undefined, 'realistic'] as const) {
    const input = fixture();
    input.renderConfig = { category: 'wardrobe', stagingLevel: 2, ...(style ? { style } : {}) };
    await handleDesignImage(request(input), environment, async (_url, init) => { bodies.push(String(init?.body)); return completed(); });
  }
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
});

test('category defaults follow furniture, and invalid render options or manifest state never reach the provider', async () => {
  const kitchen = fixture();
  kitchen.specification.design.furniture = kitchen.specification.design.furniture.map(piece => ({ ...piece, product: 'kitchen' }));
  const response = await handleDesignImage(request(kitchen), environment, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.match(body.system_instruction, /espresso machine/);
    assert.match(body.system_instruction, /Level 2/);
    assert.match(body.system_instruction, /natural bounce light/);
    assert.match(body.system_instruction, /preserving the open top clearance/);
    return completed();
  });
  assert.equal(response.status, 200);
  let calls = 0;
  for (const renderConfig of [
    { category: 'wardrobe', stagingLevel: 0 }, { category: 'wardrobe', stagingLevel: 4 },
    { category: 'wardrobe', stagingLevel: 2, hasIntegratedLed: 'false' },
    { category: 'wardrobe', stagingLevel: 2, hasCeilingBulkhead: 1 },
    { category: 'kitchen', stagingLevel: 2 }, { category: 'bedroom', stagingLevel: 2 },
    { category: 'wardrobe', stagingLevel: 2, style: 'watercolor' }, { category: 'wardrobe', stagingLevel: 2, style: null },
  ]) {
    const invalid = { ...fixture(), renderConfig };
    assert.equal((await handleDesignImage(request(invalid), environment, async () => { calls++; return completed(); })).status, 400);
  }
  for (const replacement of [{ finish: 'invalid' }, { sections: [{}] }, { sections: [{ width: 50, items: null, dividers: [] }] }]) {
    const invalid = fixture();
    Object.assign(invalid.specification.design.furniture[0]!, replacement);
    assert.equal((await handleDesignImage(request(invalid), environment, async () => { calls++; return completed(); })).status, 400);
  }
  assert.equal(calls, 0);
});

test('selected per-wing finishes, overrides, box counts and module geometry survive serialization into the final text block', async () => {
  const built = buildFromSpec({ specVersion: 1, wardrobes: [
    { width: 180, height: 220, depth: 60 }, { width: 120, height: 220, depth: 60 },
  ] }, 'manifest-private-id');
  assert.ok(built.ok);
  const scene = projectToScene(built.project)!;
  const [left, right] = scene.wardrobes;
  left!.name = 'Left wing'; left!.state.fin = 'Oak'; left!.state.doors = 'hinged';
  left!.state.n = 1; left!.state.wt = [1];
  left!.state.secs = [[
    { k: 'drawer', h: 22, y: 0, x: 0, w: 60, f: 'White' },
    { k: 'drawer', h: 22, y: 0, x: 60, w: 60 },
    { k: 'seasonal', h: 40, y: 150, boxes: 2 },
  ]];
  left!.state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: 176.4, y: 149 }];
  right!.name = 'Right wing'; right!.state.fin = 'Graphite'; right!.state.doors = 'none';
  right!.state.materials = defaultMaterials('Graphite');
  right!.angle = 90; right!.state.n = 1; right!.state.wt = [1];
  right!.state.secs = [[{ k: 'pants', h: 75, y: 0 }, { k: 'short', h: 106, y: 80 }]];
  const input = { ...fixture(), specification: imageDesignSpecification(scene) };
  const before = JSON.stringify(input.specification);
  const summary = serializeConfigurationSummary(input.specification);
  assert.match(summary, /Carcass & Exterior Fronts \(Unified Decor\): Egger H1318 ST10[\s\S]*Configured Module Layout: Wing\/module 1 \(Left wing\)/);
  assert.match(summary, /Fitting finish overrides: Egger W1100 ST9/);
  assert.match(summary, /Carcass & Exterior Fronts \(Unified Decor\): Egger U963 ST9[\s\S]*Configured Module Layout: Wing\/module 2 \(Right wing\)/);
  assert.match(summary, /Upper boxes with 2 storage boxes/);
  assert.match(summary, /Hanging rail/);
  assert.match(summary, /Trouser pull-out/);
  assert.match(summary, /horizontal divider at x=0, y=148\.1/);
  assert.match(summary, /solid outer doors/);
  assert.match(summary, /rotation 90°; no outer doors \(open bays\)/);
  assert.equal((summary.match(/Drawer \[/g) ?? []).length, 2);
  assert.ok(summary.indexOf('Upper boxes with 2') < summary.indexOf('Drawer ['), 'items read top to bottom');
  assert.doesNotMatch(summary, /Walnut|Sage|manifest-private-id|editorItem|technicalDrawings/);
  assert.equal(JSON.stringify(input.specification), before, 'serialization does not mutate the captured configuration');
  const response = await handleDesignImage(request(input), environment, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.ok(body.input.at(-1).text.includes(summary));
    assert.match(body.input.at(-1).text, /TIER 2 Room Completion/);
    return completed();
  });
  assert.equal(response.status, 200);
});

test('mixed image and text output preserves final text in order and excludes thought steps', async () => {
  const response = await handleDesignImage(request(), environment, async () => Response.json({ status: 'completed', steps: [
    { type: 'thought', content: [{ type: 'text', text: 'Private reasoning' }] },
    { type: 'model_output', content: [
      { type: 'text', text: '  An oak corner wardrobe.  ' },
      { type: 'image', mime_type: 'image/png', data: png },
      { type: 'text', text: '' },
    ] },
    { type: 'model_output', content: [{ type: 'text', text: 'Warm lighting in the open shelves.' }] },
  ] }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    model: 'gemini-nano-banana-2.1', image: { mimeType: 'image/png', data: png },
    text: 'An oak corner wardrobe.\n\nWarm lighting in the open shelves.',
  });
});

test('missing credentials, cross-origin calls, unsupported methods and content types fail before Gemini', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return completed(); };
  const missingKey = await handleDesignImage(request(), { ...environment, GEMINI_API_KEY: '' }, fetcher);
  assert.equal(missingKey.status, 503);
  assert.deepEqual(await missingKey.json(), { error: { code: 'NOT_CONFIGURED', message: 'Image generation is temporarily unavailable. Please try again later.' } });
  assert.equal((await handleDesignImage(request(undefined, { Origin: 'https://other.example' }), environment, fetcher)).status, 403);
  assert.equal((await handleDesignImage(request(undefined, { 'Content-Type': 'text/plain' }), environment, fetcher)).status, 415);
  const get = await handleDesignImage(new Request('https://design.example/api/design-images'), environment, fetcher);
  assert.equal(get.status, 405); assert.equal(get.headers.get('Allow'), 'POST'); assert.equal(calls, 0);
});

test('invalid JSON, empty furniture, repeated views, non-base64 images and oversized bodies cannot reach Gemini', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return completed(); };
  const repeated = fixture(); repeated.references[1]!.view = 'front';
  const empty = fixture(); empty.specification.design.furniture = [];
  const badImage = fixture(); badImage.references[0]!.data = 'https://remote.example/image';
  const wrongResolution = fixture(); wrongResolution.references[0]!.width = 1440; wrongResolution.references[0]!.height = 1080;
  for (const body of [repeated, empty, badImage, wrongResolution, {}]) {
    assert.equal((await handleDesignImage(request(body), environment, fetcher)).status, 400);
  }
  const badJson = new Request('https://design.example/api/design-images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal((await handleDesignImage(badJson, environment, fetcher)).status, 400);
  const large = request(undefined, { 'Content-Length': String(MAX_REQUEST_BYTES + 1) });
  assert.equal((await handleDesignImage(large, environment, fetcher)).status, 413);
  const streamed = new Request('https://design.example/api/design-images', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(MAX_REQUEST_BYTES + 1),
  });
  assert.equal((await handleDesignImage(streamed, environment, fetcher)).status, 413); assert.equal(calls, 0);
});

test('rate limiting rejects a generation without spending a provider request', async () => {
  let calls = 0;
  const response = await handleDesignImage(request(), { ...environment, AI_RATE_LIMITER: { async limit() { return { success: false }; } } },
    async () => { calls++; return completed(); });
  assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60'); assert.equal(calls, 0);
});

test('large generated PNG payloads validate without regex stack overflow while malformed base64 is refused', () => {
  assert.equal(generatedImageData.safeParse('A'.repeat(32 * 1024 * 1024)).success, true);
  assert.equal(imageData.safeParse('A'.repeat(8 * 1024 * 1024)).success, false);
  for (const invalid of ['a===', 'aa=a', 'abcde', '====', 'https://host/image']) {
    assert.equal(generatedImageData.safeParse(invalid).success, false);
  }
});

test('provider errors and missing images return safe errors without exposing upstream bodies or keys', async t => {
  const logs: string[] = [];
  t.mock.method(console, 'error', (line: string) => { logs.push(line); });
  for (const [status, expected] of [[400, 502], [401, 503], [403, 503], [404, 502], [429, 429], [500, 502]] as const) {
    const response = await handleDesignImage(request(), environment,
      async () => new Response('sensitive provider body: test-server-secret', { status }));
    assert.equal(response.status, expected);
    const body = await response.json() as { error: { message: string } };
    assert.doesNotMatch(body.error.message, /sensitive|test-server-secret|credentials|billing|quota|configuration/i);
    const logged = JSON.parse(logs.at(-1)!);
    assert.equal(logged.providerStatus, status);
    assert.equal(logged.requestId, response.headers.get('X-Request-ID'));
    assert.deepEqual(Object.keys(logged).sort(), ['code', 'event', 'model', 'providerMessage', 'providerReason', 'providerStatus', 'requestId']);
    assert.equal(logged.providerReason, null); assert.equal(logged.providerMessage, null);
    assert.doesNotMatch(logs.at(-1)!, /sensitive|test-server-secret/);
  }
  const noImage = await handleDesignImage(request(), environment,
    async () => Response.json({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Cannot create' }] }] }));
  assert.equal(noImage.status, 502); assert.equal((await noImage.json() as { error: { code: string } }).error.code, 'NO_IMAGE');
  const abort = new AbortController(), cancelled = new Request(request(), { signal: abort.signal });
  abort.abort();
  const stopped = await handleDesignImage(cancelled, environment, async (_url, init) => {
    assert.equal(init?.signal?.aborted, true); throw init!.signal!.reason;
  });
  assert.equal(stopped.status, 499);
});

test('the browser ignores internal or unknown API messages, including responses from an older deployment', async t => {
  let code: unknown = 'NOT_CONFIGURED';
  const message = 'Set GEMINI_API_KEY on the server. Credentials, billing and quota configuration need attention.';
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { code, message } }, { status: 503 }));
  for (code of ['NOT_CONFIGURED', 'PROVIDER_CONFIGURATION', 'PROVIDER_LIMIT', 'UNKNOWN_INTERNAL_FAILURE', 'constructor', null]) {
    await assert.rejects(requestDesignImage(fixture(), new AbortController().signal), error => {
      assert.equal(designImageErrorMessage(error), 'Image generation is temporarily unavailable. Please try again later.');
      assert.doesNotMatch(designImageErrorMessage(error), /GEMINI_API_KEY|credentials|billing|quota|configuration/i);
      return true;
    });
  }
});

test('only approved customer errors reach the status message; unexpected exceptions use a safe fallback', () => {
  for (const error of [new Error('Set GEMINI_API_KEY'), new TypeError('Internal API credentials failed'), 'raw provider error', null]) {
    assert.equal(designImageErrorMessage(error), 'Image generation is temporarily unavailable. Please try again later.');
  }
  assert.equal(designImageErrorMessage(new DesignImageUserError('EMPTY_DESIGN')), 'Add furniture to your design before creating an image.');
  assert.equal(designImageErrorMessage(new DesignImageUserError('RATE_LIMITED')), 'Please wait a minute before creating another image.');
  assert.equal(designImageErrorMessage(new DOMException('Internal timeout details', 'TimeoutError')),
    'Creating your image is taking longer than expected. Please try again.');
});

test('photo geometry removes editing overlays, restores ghosted materials and closes doors without mutating the live scene', () => {
  const wood = new THREE.MeshStandardMaterial(), ghost = wood.clone(); ghost.opacity = .1;
  const cabinet = new THREE.Group(), board = new THREE.Mesh(new THREE.BoxGeometry(), ghost);
  board.userData.origMaterial = wood;
  cabinet.add(board, new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: .2 }));
  cabinet.add(glow);
  const pivot = new THREE.Group(); pivot.rotation.y = 1.6; pivot.userData = { t: 1.6, state: { open: true } }; cabinet.add(pivot);
  const clone = photoGeometry(cabinet);
  assert.equal((clone.children[0] as THREE.Mesh).material, wood); assert.equal(board.material, ghost);
  assert.equal(clone.children[1]!.visible, false); assert.equal(clone.children[2]!.visible, false);
  assert.equal(clone.children[3]!.rotation.y, 0); assert.equal(pivot.rotation.y, 1.6);
  assert.equal(board.userData.origMaterial, wood);
  const moving = new THREE.Group(); moving.position.set(12, 14, 20); cabinet.add(moving);
  const resting = photoGeometry(cabinet, new Set([moving]));
  assert.deepEqual(resting.children.at(-1)!.position.toArray(), [0, 0, 0]);
  assert.deepEqual(moving.position.toArray(), [12, 14, 20]);
});

test('Worker serves existing assets and keeps unknown API routes out of the static fallback', async () => {
  let assets = 0;
  const env = { ...environment, ASSETS: { async fetch() { assets++; return new Response('editor'); } } };
  assert.equal(await (await worker.fetch(new Request('https://design.example/editor.html'), env)).text(), 'editor');
  assert.equal((await worker.fetch(new Request('https://design.example/api/missing'), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://design.example/api/design-images'), env)).status, 405);
  assert.equal(assets, 1);
});

test('the design JSON preview removes drawing vectors and deduplicates repeated review issues', () => {
  const spec = fixture().specification;
  const issue = { id: 'a', kind: 'alignment', severity: 'review', message: 'K1 / K2: undersides differ by 1 mm', marks: ['K1', 'K2'], at: { x: 1, y: 2 }, rule: 'r' };
  const sheets = spec.technicalDrawings.map(sheet => ({ ...sheet, issues: [issue, { ...issue, id: 'b', at: { x: 9, y: 9 } }] }));
  const compact = modelSpecification({ ...spec, technicalDrawings: sheets }) as {
    design: unknown; technicalDrawings: Record<string, unknown>[]; reviewIssues: unknown[];
  };
  assert.deepEqual(compact.design, JSON.parse(JSON.stringify(spec.design)), 'authoritative design geometry is unchanged');
  assert.equal(compact.technicalDrawings.length, spec.technicalDrawings.length);
  assert.ok(compact.technicalDrawings.every(sheet => !('views' in sheet) && !('issues' in sheet)));
  assert.ok(compact.technicalDrawings.some(sheet => sheet.title === 'Cutting list' && sheet.table));
  assert.deepEqual(compact.reviewIssues, [{ kind: 'alignment', severity: 'review', message: issue.message, marks: ['K1', 'K2'], rule: 'r' }]);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(spec).length);
});

test('design JSON and camera metadata never enter the provider request, including large specifications', async () => {
  const input = fixture();
  const marker = 'PRIVATE_DESIGN_JSON_SENTINEL';
  (input.specification as unknown as Record<string, unknown>).notes = marker + 'x'.repeat(200_000);
  input.references[0]!.camera.position = [123456789, 180, 600];
  let calls = 0;
  const response = await handleDesignImage(request(input), environment, async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(String(init?.body).includes(marker), false);
    assert.equal(String(init?.body).includes('123456789'), false);
    assert.deepEqual(body.input.filter((part: { type: string }) => part.type === 'image').map((part: { data: string }) => part.data),
      input.references.map(image => image.data));
    return completed();
  });
  assert.equal(response.status, 200); assert.equal(calls, 1);
});

test('operator logs carry Google\'s error status and a redacted, capped message, never the raw body', async t => {
  const logs: string[] = [];
  t.mock.method(console, 'error', (line: string) => { logs.push(line); });
  const key = 'AIza' + 'S'.repeat(35), image = 'Q'.repeat(500);
  const response = await handleDesignImage(request(), environment, async () => Response.json({ error: {
    code: 400, status: 'INVALID_ARGUMENT', message: `The input token count exceeds the maximum. key=${key} data=${image} ${'pad '.repeat(200)}`,
  } }, { status: 400 }));
  assert.equal(response.status, 502);
  const body = await response.json() as { error: { code: string; message: string } };
  assert.equal(body.error.code, 'PROVIDER_ERROR'); assert.doesNotMatch(body.error.message, /token|INVALID_ARGUMENT/);
  const logged = JSON.parse(logs.at(-1)!);
  assert.equal(logged.providerStatus, 400); assert.equal(logged.providerReason, 'INVALID_ARGUMENT');
  assert.match(logged.providerMessage, /^The input token count exceeds the maximum\./);
  assert.ok(logged.providerMessage.length <= 300);
  assert.doesNotMatch(logs.at(-1)!, new RegExp(key + '|' + image));
});

test('debugging mode mocks Gemini call and returns mock response (defaults to 10s delay)', async () => {
  const input = fixture();
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return completed(); };
  const start = Date.now();
  const response = await handleDesignImage(
    request(input, { 'X-Debug-Mode': 'true' }),
    { ...environment, GEMINI_API_KEY: '', AI_MOCK_DELAY_MS: 100 },
    fetcher,
  );
  const elapsed = Date.now() - start;
  assert.equal(response.status, 200);
  assert.equal(calls, 0, 'Gemini provider fetcher is not called in debug mode');
  assert.ok(elapsed >= 90 && elapsed <= 1000, `Expected ~100ms delay in test, elapsed: ${elapsed}ms`);
  const result = await response.json();
  assert.equal(result.model, 'gemini-nano-banana-2.1');
  assert.equal(result.image.data, input.references[0]!.data);
  assert.match(result.text, /Debug Mock/);
});

test('debugging mode mock respects request cancellation during the wait', async () => {
  const input = fixture();
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);
  const cancelled = new Request(request(input, { 'X-Debug-Mode': 'true' }), { signal: controller.signal });
  const response = await handleDesignImage(
    cancelled,
    { ...environment, GEMINI_API_KEY: '', AI_MOCK_DELAY_MS: 10000 },
  );
  assert.equal(response.status, 499);
});
