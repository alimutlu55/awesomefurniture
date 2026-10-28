import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_LANGUAGES, chooseLanguage, supportedLanguage } from '../../src/presentation/i18n/languages';
import { translateMessage } from '../../src/presentation/i18n/message';

test('explicit and saved languages take precedence over regional browser preferences', () => {
  assert.equal(chooseLanguage('de', 'pl', ['fr-FR']), 'de');
  assert.equal(chooseLanguage(null, 'en', ['tr-TR']), 'en');
  assert.equal(chooseLanguage('unsupported', null, ['ja-JP', 'pt-BR']), 'pt');
  assert.equal(chooseLanguage(null, null, ['ja-JP']), 'en');
  assert.equal(supportedLanguage('PL-pl'), 'pl');
  assert.equal(supportedLanguage('__proto__'), null);
});

test('each language has matching messages and preserves every interpolation slot', () => {
  let keys: string[] | null = null;
  for (const { code } of APP_LANGUAGES.filter(language => language.code !== 'en')) {
    const messages = JSON.parse(readFileSync(`src/presentation/i18n/locales/${code}.json`, 'utf8')) as Record<string, string>;
    const next = Object.keys(messages).sort();
    if (keys) assert.deepEqual(next, keys, code); else keys = next;
    for (const [source, target] of Object.entries(messages)) {
      assert.ok(target.trim(), `${code}: ${source}`);
      assert.deepEqual([...target.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(),
        [...source.matchAll(/\{(\d+)(?::n|:ui)?\}/g)].map(m => `{${m[1]}}`).sort(), `${code}: ${source}`);
      assert.ok(!/<\/?(?:script|style|img|a|div)\b/.test(target), 'Translation is text, never executable markup');
    }
    for (const message of ['Language', 'Auto design', 'New design', 'Your designs', 'Technical drawings', 'Sign in', 'Buy credits', 'Width', 'Close']) {
      assert.ok(messages[message], `${code}: essential workflow missing ${message}`);
    }
  }
});

test('exact translation preserves whitespace, technical values and unknown messages', () => {
  const messages = { Width: 'Szerokość', 'Edited {0}': 'Edytowano {0}', 'Delete “{0}”?': 'Usunąć „{0}”?', 'Part (A) {0}': 'Część (A) {0}' };
  assert.equal(translateMessage('  Width\n', messages), '  Szerokość\n');
  assert.equal(translateMessage('240.5 cm', messages), '240.5 cm');
  assert.equal(translateMessage('My furniture named Width', messages), 'My furniture named Width');
  assert.equal(translateMessage('Edited 28.10.2026', messages), 'Edytowano 28.10.2026');
  assert.equal(translateMessage('Delete “<my design>”?', messages), 'Usunąć „<my design>”?');
  assert.equal(translateMessage('Part (A) 240', messages), 'Część (A) 240');
  assert.equal(translateMessage('Part XA 240', messages), 'Part XA 240');
  assert.equal(translateMessage('Width', {}), 'Width');
  assert.equal(translateMessage('constructor', {}), 'constructor');
  const counted = { '{0:n} credits': 'Kredyty: {0}' };
  assert.equal(translateMessage('Get credits', counted), 'Get credits');
  assert.equal(translateMessage('1,200 credits', counted), 'Kredyty: 1,200');
  assert.equal(translateMessage('Look: Midday', { 'Look: {0:ui}': 'Wygląd: {0}', Midday: 'Południe' }), 'Wygląd: Południe');
});
