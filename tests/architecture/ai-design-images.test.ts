import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { imageDesignSpecification } from '../../src/application/projects/image-design-specification';
import { IMAGE_VIEWS, type DesignImageRequest } from '../../src/application/projects/design-image';
import { handleDesignImage } from '../../src/infrastructure/gemini/design-image-handler';
import { MAX_REQUEST_BYTES, generatedImageData, imageData } from '../../src/infrastructure/gemini/design-image-contract';
import { photoGeometry } from '../../src/presentation/viewport/capture-design-references';
import worker from '../../src/app/worker';
import { requestDesignImage } from '../../src/presentation/ai/design-image-client';
import { designImageErrorMessage, DesignImageUserError } from '../../src/presentation/ai/design-image-errors';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJxkAAAAASUVORK5CYII=';
function fixture(): DesignImageRequest {
  const built = buildFromSpec({ specVersion: 1, room: { width: 360, depth: 220, height: 260 },
    wardrobes: [{ against: 1, width: 180, height: 220, depth: 60, shape: 'sloped' }] }, 'private-project-id');
  assert.ok(built.ok);
  const scene = projectToScene(built.project)!;
  return { specification: imageDesignSpecification(scene), references: IMAGE_VIEWS.map(view => ({
    view, mimeType: 'image/jpeg', data: '/9j/2Q==', width: 1440, height: 1080,
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

test('server sends the exact design and three labeled images to Nano Banana 2.1 with a server-only header', async () => {
  let calls = 0;
  const input = fixture();
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), environment.GEMINI_API_KEY);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'gemini-nano-banana-2.1'); assert.equal(body.store, false);
    assert.equal(body.response_format.image_size, '4K');
    assert.equal(body.response_format.mime_type, 'image/jpeg', 'Interactions ImageResponseFormat only permits JPEG output');
    assert.equal(body.response_format.delivery, 'inline');
    assert.equal(body.generation_config.thinking_level, 'high');
    assert.deepEqual(JSON.parse(body.input[0].text.split('\n').slice(1).join('\n')), JSON.parse(JSON.stringify(input.specification)));
    assert.equal(body.input.filter((p: { type: string }) => p.type === 'image').length, 3);
    assert.match(body.system_instruction, /Do not redesign/);
    assert.equal(String(init?.body).includes(environment.GEMINI_API_KEY), false);
    return completed();
  };
  const response = await handleDesignImage(request(input), environment, fetcher);
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { model: 'gemini-nano-banana-2.1', image: { mimeType: 'image/png', data: png } });
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
  for (const body of [repeated, empty, badImage, {}]) {
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
    assert.deepEqual(Object.keys(logged).sort(), ['code', 'event', 'model', 'providerStatus', 'requestId']);
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
