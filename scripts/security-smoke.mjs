import assert from 'node:assert/strict';

/** Small, read-only production probes. Never submits credentials, creates accounts or calls the AI provider. */
export async function securitySmoke(base = 'https://furnidraw.com', fetcher = fetch) {
  const checks = [
    ['/', [200]], ['/editor.html', [200]],
    ['/.env.production', [403, 404]], ['/.git/HEAD', [403, 404]], ['/.aws/credentials', [403, 404]],
    ['/api/env', [404]], ['/api/credits', [401]],
    ['/api/design-images?debug', [401], { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Mode': 'true' }, body: '{}' }],
    ['/api/payments/stripe/webhook', [400], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }],
  ];
  const failures = [];
  for (const [path, statuses, init] of checks) {
    try {
      const response = await fetcher(new URL(path, base), { ...init, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
      assert.ok(statuses.includes(response.status), `${path}: unexpected HTTP ${response.status}`);
      if (path === '/' || path === '/editor.html' || path === '/api/env') {
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${path}: missing nosniff`);
        assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN', `${path}: missing frame protection`);
        assert.ok(response.headers.get('content-security-policy'), `${path}: missing CSP`);
      }
      await response.body?.cancel();
      console.log(`${path}: HTTP ${response.status}, verified`);
    } catch (error) { failures.push(error instanceof Error ? error.message : `${path}: request failed`); }
  }
  if (failures.length) throw new Error(failures.join('\n'));
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) await securitySmoke();
