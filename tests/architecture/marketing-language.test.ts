import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderMarketing } from '../../scripts/marketing-site';
import { languages, homePath } from '../../src/presentation/marketing/translations';
import { homeCopy } from '../../src/presentation/marketing/home-copy';
import { escapeHtml } from '../../src/presentation/marketing/seo';
import { APP_LANGUAGES } from '../../src/presentation/i18n/languages';

const template = readFileSync('index.html', 'utf8');
test('the homepage selector covers every studio language and marks the current route', () => {
  assert.deepEqual(languages.map(l => l.lang), APP_LANGUAGES.map(l => l.code));
  for (const language of languages) {
    const html = renderMarketing(template, homePath(language.lang));
    const menu = html.match(/<details class="site-language">[\s\S]*?<\/details>/)![0];
    assert.equal((menu.match(/aria-current="page"/g) ?? []).length, 1);
    for (const option of languages) {
      assert.ok(menu.includes(`href="${homePath(option.lang)}" lang="${option.lang}" hreflang="${option.lang}"`));
      assert.ok(menu.includes(option.name));
    }
    assert.ok(menu.includes(`data-site-language="${language.lang}"\n        aria-current="page"`));
    assert.ok(html.includes(`/editor/?lang=${language.lang}`));
  }
});
test('localized routes render the new hero, preview and all six features before JavaScript', () => {
  const headings = new Set<string>();
  for (const language of languages) {
    const copy = homeCopy(language.lang), html = renderMarketing(template, homePath(language.lang));
    assert.ok(html.includes(`<h1>${escapeHtml(copy.headline)}</h1>`));
    headings.add(copy.headline);
    for (const text of [copy.title, copy.emphasis, copy.continue, copy.loading, ...copy.counts]) {
      assert.ok(html.includes(escapeHtml(text)), `${language.lang}: ${text}`);
    }
    assert.equal(copy.counts.length, 4);
    assert.equal(copy.features.length, 6);
    for (const feature of copy.features) {
      assert.ok(html.includes(`<h2>${escapeHtml(feature.t)}</h2>`));
      assert.ok(html.includes(escapeHtml(feature.p)));
      assert.equal(feature.b.length, 3);
    }
    assert.ok(html.includes(`data-invalid="${escapeHtml(copy.invalid)}"`));
  }
  assert.equal(headings.size, languages.length);
});
