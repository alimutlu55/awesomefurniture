import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBoundedText, RequestBodyError } from '../../src/infrastructure/http/request-body';
import { SECURITY_HEADERS } from '../../src/infrastructure/http/security-headers';
import { protectRequest, sensitivePath } from '../../src/infrastructure/http/request-security';
import { auditPublicAssets } from '../../scripts/security-build';
import { handleDesignImage } from '../../src/infrastructure/gemini/design-image-handler';
import { handleAccount } from '../../src/infrastructure/account/account-http';
import { CreditError } from '../../src/application/credits/credit-service';
import type { FeatureCharge } from '../../src/infrastructure/credits/image-charge';
import worker from '../../src/app/worker';
import { securitySmoke } from '../../scripts/security-smoke.mjs';

const allowed = { async limit() { return { success: true }; } };
const imageEnv = { GEMINI_API_KEY: 'configured', AI_RATE_LIMITER: allowed };
function streamed(body: string, headers: HeadersInit = {}) {
  let reads = 0, cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { reads++; controller.enqueue(new TextEncoder().encode(body)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const request = new Request('https://app.test/api/design-images', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: stream, duplex: 'half',
  } as RequestInit);
  return { request, reads: () => reads, cancelled: () => cancelled };
}

test('request limits count UTF-8 bytes, cancel oversized streams and reject declared oversize before reading', async () => {
  const utf8 = streamed('ééé');
  await assert.rejects(readBoundedText(utf8.request, 5), (e: RequestBodyError) => e.status === 413);
  assert.equal(utf8.reads(), 1); assert.equal(utf8.cancelled(), true);
  const declared = streamed('{}', { 'Content-Length': '100' });
  await assert.rejects(readBoundedText(declared.request, 5), (e: RequestBodyError) => e.status === 413);
  assert.equal(declared.reads(), 0);
  assert.equal(await readBoundedText(new Request('https://app.test', { method: 'POST', body: 'é' }), 2), 'é');
});

test('production ignores all caller debug controls and LOG_LEVEL cannot enable mocks', async () => {
  for (const path of ['/api/design-images', '/api/design-images?debug']) {
    const request = new Request('https://app.test' + path, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Mode': 'true' }, body: '{}' });
    const response = await handleDesignImage(request, { ...imageEnv, GEMINI_API_KEY: '', LOG_LEVEL: 'debug' });
    assert.equal(response.status, 503);
  }
});

test('AI refuses rate-limited and unauthenticated callers before reading images or reserving credits', async () => {
  const blocked = streamed('{}');
  const rate = await handleDesignImage(blocked.request, { ...imageEnv, AI_RATE_LIMITER: {
    async limit() { return { success: false }; },
  } });
  assert.equal(rate.status, 429); assert.equal(blocked.reads(), 0);
  const unauth = streamed('{}');
  const charge: FeatureCharge = {
    async authorize() { throw new CreditError('SIGN_IN_REQUIRED', 'Sign in.'); },
    async begin() { throw new Error('must not reserve'); },
  };
  assert.equal((await handleDesignImage(unauth.request, imageEnv, fetch, charge)).status, 401);
  assert.equal(unauth.reads(), 0);
});

test('AI account quota survives IP changes and refuses before parsing the request', async () => {
  const keys: string[] = [];
  const charge: FeatureCharge = {
    async authorize() { return 'verified-account'; }, async begin() { throw new Error('must not reserve'); },
  };
  for (const ip of ['192.0.2.1', '192.0.2.2']) {
    const input = streamed('{}', { 'CF-Connecting-IP': ip });
    const response = await handleDesignImage(input.request, { ...imageEnv, AI_RATE_LIMITER: {
      async limit({ key }) { keys.push(key); return { success: !key.startsWith('user:') }; },
    } }, fetch, charge);
    assert.equal(response.status, 429); assert.equal(input.reads(), 0);
  }
  assert.deepEqual(keys, ['ip:192.0.2.1', 'user:verified-account', 'ip:192.0.2.2', 'user:verified-account']);
});

test('account merge authenticates first and bounds the guest proof by bytes', async () => {
  const input = streamed('x'.repeat(17 * 1024), { Authorization: 'Bearer valid' });
  const request = new Request('https://app.test/api/account/merge', input.request);
  const runtime = { verify: async () => ({ id: 'account', anonymous: false, email: 'person@example.test' }),
    store: { async merge() { throw new Error('must not merge'); } } };
  assert.equal((await handleAccount(request, runtime)).status, 413);
  assert.equal(input.cancelled(), true);
  const unauth = streamed('{}');
  const refused = await handleAccount(new Request('https://app.test/api/account/merge', unauth.request), runtime);
  assert.equal(refused.status, 401); assert.equal(unauth.reads(), 0);
});

test('API quotas leave signed Stripe delivery independent and preserve well-known resources', async () => {
  let calls = 0;
  const limiter = { async limit() { calls++; return { success: false }; } };
  const request = (path: string) => new Request('https://app.test' + path);
  assert.equal((await protectRequest(request('/api/credits'), limiter))?.status, 429);
  assert.equal(await protectRequest(request('/api/payments/stripe/webhook'), limiter), null);
  assert.equal(await protectRequest(request('/.well-known/security.txt'), limiter), null);
  assert.equal(calls, 1);
  for (const path of ['/.env.production', '/nested/.env', '/.git/HEAD', '/.aws/credentials', '/%2eenv', '/terraform.tfstate']) {
    assert.equal(sensitivePath(path), true, path);
    assert.equal((await protectRequest(request(path), limiter))?.status, 404);
  }
});

test('CSP reporting logs only a validated directive, never supplied URLs or payloads', async t => {
  const logs: string[] = []; t.mock.method(console, 'info', (line: string) => logs.push(line));
  const response = await protectRequest(new Request('https://app.test/api/security/csp-report', {
    method: 'POST', body: JSON.stringify({ 'csp-report': { 'effective-directive': 'script-src-elem',
      'document-uri': 'https://app.test/?token=private', 'blocked-uri': 'https://private.test' } }),
  }), allowed);
  assert.equal(response?.status, 204);
  assert.deepEqual(logs.map(line => JSON.parse(line)), [{ event: 'security_csp_violation', directive: 'script-src-elem' }]);
});

test('static and API responses share security headers, with full CSP staged as report-only', async () => {
  const file = await readFile('public/_headers', 'utf8');
  const env = { ...imageEnv, API_RATE_LIMITER: allowed, ASSETS: { async fetch() { return new Response('editor'); } } };
  for (const path of ['/', '/api/missing', '/.env']) {
    const response = await worker.fetch(new Request('https://app.test' + path), env);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(response.headers.get(name), value); assert.ok(file.includes(`  ${name}: ${value}\n`));
    }
  }
  assert.match(SECURITY_HEADERS['Content-Security-Policy-Report-Only']!, /challenges.cloudflare.com/);
  assert.doesNotMatch(SECURITY_HEADERS['Content-Security-Policy']!, /script-src/);
});

test('the deployment scan rejects accidental secrets, source maps and nested sensitive files without printing their values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'furnidraw-security-'));
  try {
    await mkdir(join(root, '.well-known')); await writeFile(join(root, '.well-known/security.txt'), 'Contact: mailto:security@example.test');
    await writeFile(join(root, 'app.js'), 'const key="sb_publishable_browser_key";'); await auditPublicAssets(root);
    for (const [name, contents] of [
      ['.env.production', 'private'], ['app.js.map', '{}'], ['dump.sql', 'private'],
      ['app.js', 'const secret="sb_secret_' + 'x'.repeat(32) + '";'],
    ]) {
      await writeFile(join(root, name!), contents!);
      await assert.rejects(auditPublicAssets(root), error => error instanceof Error && !error.message.includes('x'.repeat(32)));
      await rm(join(root, name!));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('production monitoring fails on exposed files and never submits a valid identity or payment', async t => {
  t.mock.method(console, 'log', () => {});
  const fetcher = (expose: boolean): typeof fetch => async (url, init) => {
    const path = new URL(String(url)).pathname;
    assert.equal(new Headers(init?.headers).has('authorization'), false);
    const status = path === '/' || path === '/editor.html' ? 200
      : path === '/api/credits' || path === '/api/design-images' ? 401
      : path.endsWith('/webhook') ? 400 : expose && path === '/.env.production' ? 200 : 404;
    return new Response(null, { status, headers: {
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "object-src 'none'",
    } });
  };
  await securitySmoke('https://app.test', fetcher(false));
  await assert.rejects(securitySmoke('https://app.test', fetcher(true)), /\.env.production: unexpected HTTP 200/);
});

test('production monitoring follows the canonical editor route and rejects external redirects', async t => {
  t.mock.method(console, 'log', () => {});
  const fetcher = (external: boolean): typeof fetch => async url => {
    const path = new URL(String(url)).pathname;
    if (path === '/editor.html') return new Response(null, { status: 307,
      headers: { location: external ? 'https://other.test/editor' : '/editor' } });
    const status = path === '/' || path === '/editor' ? 200
      : path === '/api/credits' || path === '/api/design-images' ? 401 : path.endsWith('/webhook') ? 400 : 404;
    return new Response(null, { status, headers: {
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "object-src 'none'",
    } });
  };
  await securitySmoke('https://app.test', fetcher(false));
  await assert.rejects(securitySmoke('https://app.test', fetcher(true)), /Editor redirected outside the app/);
});
