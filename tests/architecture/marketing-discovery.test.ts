import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editorEntry } from '../../src/presentation/marketing/entry-route';
import { languages, homePath } from '../../src/presentation/marketing/translations';
import { guides } from '../../src/presentation/marketing/guides';
import { renderMarketing, sitemap, publicPaths, isIndexableBuild } from '../../scripts/marketing-site';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';

const template = readFileSync('index.html', 'utf8');
test('international public pages contain their complete content before JavaScript runs', () => {
  const titles = new Set<string>();
  for (const copy of languages) {
    const path = homePath(copy.lang), html = renderMarketing(template, path);
    assert.ok(html.includes(`<html lang="${copy.lang}"`));
    assert.ok(html.includes(`<link rel="canonical" href="https://furnidraw.com${path}">`));
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    for (const line of copy.headline) assert.ok(html.includes(line));
    for (const other of languages) assert.ok(html.includes(`hreflang="${other.lang}" href="https://furnidraw.com${homePath(other.lang)}"`));
    assert.ok(html.includes('hreflang="x-default"'));
    const title = html.match(/<title>(.*?)<\/title>/)![1]!;
    assert.equal(titles.has(title), false); titles.add(title);
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]!);
    assert.ok(data['@graph'].some((node: { '@type': string }) => node['@type'] === 'WebApplication'));
    assert.ok(!html.includes('aggregateRating'), 'no invented reviews');
  }
});

test('search pages have distinct useful text, one heading and their own canonical address', () => {
  for (const guide of guides) {
    const html = renderMarketing(template, `/${guide.slug}/`);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.ok(html.includes(`href="https://furnidraw.com/${guide.slug}/"`));
    assert.ok(html.includes(guide.sections[0]!.title));
    assert.ok(html.includes('BreadcrumbList'));
    assert.ok(!html.includes('hreflang="x-default"'), 'guides have no fictitious translations');
  }
});

test('shared designs, saved sessions and payment returns reach the editor unchanged', () => {
  for (const payload of ['#spec=%7B%22specVersion%22%3A1%7D', '#design=compressed_design', '?session=saved',
    '?project=old-id&view=designs', '?checkout=success&order=order-123', '?welcome=1',
    '?code=example-auth-code', '#access_token=example-token&type=recovery']) {
    const original = new URL('https://furnidraw.com/' + payload);
    const redirected = new URL(editorEntry(original.href)!);
    assert.equal(redirected.pathname, '/editor/');
    assert.equal(redirected.search, original.search); assert.equal(redirected.hash, original.hash);
  }
  for (const suffix of ['', '#details', '#notes', '?utm_source=woodworking', 'de/']) {
    assert.equal(editorEntry('https://furnidraw.com/' + suffix), null);
  }
});

test('the sitemap includes only public pages and preview builds are excluded from indexing', () => {
  const xml = sitemap();
  for (const path of publicPaths()) assert.ok(xml.includes(`<loc>https://furnidraw.com${path}</loc>`));
  assert.ok(!xml.includes('/editor/')); assert.ok(!xml.includes('/api/'));
  assert.equal(isIndexableBuild('main'), true); assert.equal(isIndexableBuild('develop'), false);
  assert.equal(isIndexableBuild('feature/demo'), false);
  assert.ok(renderMarketing(template, '/', false).includes('content="noindex,follow"'));
});

test('every illustrative size and shape opens a valid cabinet in the actual design engine', () => {
  for (const width of [140, 240, 320]) for (const shape of ['regular', 'alcove', 'under-stairs'] as const) {
    const result = buildFromSpec({ specVersion: 1, wardrobes: [{ width, height: 240, depth: 60, shape, autoDesign: false }] }, 'marketing-preview');
    assert.equal(result.ok, true, `${width} / ${shape}`);
  }
});

test('search snippets exclude illustrative geometry and assistant instructions', () => {
  const html = renderMarketing(template, '/');
  assert.match(html, /class="fitting-room" data-nosnippet/);
  assert.match(html, /<div data-nosnippet><details class="agent-note">/);
  assert.ok(html.includes('YOUR FURNITURE. FROM IDEA TO BUILD.'));
  assert.ok(html.includes('Design it.'));
});

test('application metadata describes the free design workspace without inventing reviews', () => {
  const html = renderMarketing(template, '/');
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]!);
  const app = data['@graph'].find((node: { '@type': string }) => node['@type'] === 'WebApplication');
  assert.equal(app.offers.price, 0);
  assert.ok(app.offers.description.includes('credit'));
  assert.equal(app.aggregateRating, undefined);
  assert.equal(app.review, undefined);
});

test('translated public pages pass their language into studio links', () => {
  for (const copy of languages) {
    const path = copy.lang === 'en' ? '/' : `/${copy.lang}/`;
    assert.ok(renderMarketing(template, path).includes(`href="/editor/?lang=${copy.lang}"`));
  }
});

test('public pages provide a Google-compliant favicon stack with multiples of 48px and root ICO', () => {
  const html = renderMarketing(template, '/');
  assert.ok(html.includes('<link rel="icon" href="/favicon.ico" sizes="any">'), 'root ICO for search crawler fallback');
  assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">'), 'SVG vector favicon');
  assert.ok(html.includes('<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">'), 'Google 48px requirement');
  assert.ok(html.includes('<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">'), 'Google 96px requirement');
  assert.ok(html.includes('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">'), 'Apple touch icon');
  assert.ok(html.includes('<link rel="manifest" href="/manifest.json">'), 'PWA webmanifest');

  // Verify all referenced favicon assets exist in public/ and have valid non-zero content
  for (const file of [
    'public/favicon.ico', 'public/favicon.svg', 'public/favicon-48x48.png',
    'public/favicon-96x96.png', 'public/favicon-192x192.png', 'public/favicon-512x512.png',
    'public/apple-touch-icon.png', 'public/manifest.json',
  ]) {
    const data = readFileSync(file);
    assert.ok(data.length > 50, `${file} is present and non-empty`);
  }
});
