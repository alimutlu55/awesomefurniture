// Architecture rules that keep the code modular. Runs in `npm run check` (and so in CI).
//
// Rules (each failure message says what to do):
//   1. A source file has at most MAX_LINES lines.            Split it by concern.
//   2. A line has at most MAX_LINE characters.               Break it up; name the parts.
//   3. No hand-written list of fitting kinds tested against a kind, e.g. ['drawer','sdrawer'].includes(k).
//      Give the kinds a trait in src/domain/wardrobe/fittings.ts and ask hasTrait(k, trait).
//   4. No hand-written list of possessions, e.g. ['short','long','pants'].
//      Use POSSESSION_KEYS / POSSESSIONS from src/domain/wardrobe/possessions.ts.
//   5. The domain layer has no HTML or UI copy markup. Build markup in src/presentation.
//
// Older code that predates a rule is listed in scripts/architecture-baseline.json with its current
// count. A listed file may never get worse; when you improve it, lower or remove its entry. Never
// raise a number or add a file to make the check pass: fix the code instead.
//
//   node scripts/check-architecture.mjs           check
//   node scripts/check-architecture.mjs --report  also list every counted occurrence
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MAX_LINES = 400, MAX_LINE = 240;
const ROOT = 'src', REGISTRY_FILES = new Set(['src/domain/wardrobe/fittings.ts', 'src/domain/wardrobe/possessions.ts', 'src/domain/wardrobe/purposes.ts']);
const baseline = JSON.parse(readFileSync('scripts/architecture-baseline.json', 'utf8'));
const report = process.argv.includes('--report');

const files = (function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : /\.(js|ts)$/.test(e.name) && !e.name.endsWith('.d.ts') ? [join(dir, e.name)] : []);
})(ROOT).map(f => relative('.', f).split(sep).join('/'));

const kinds = [...readFileSync('src/domain/wardrobe/fittings.ts', 'utf8').matchAll(/^ {2}\{ key: '([a-z]+)'/gm)].map(m => m[1]);
const possessions = [...readFileSync('src/domain/wardrobe/possessions.ts', 'utf8').matchAll(/key: '([a-z]+)', label:/g)].map(m => m[1]);
if (kinds.length < 5 || possessions.length < 5) throw new Error('Could not read the registries; update the patterns in check-architecture.mjs.');

const RULES = {
  fileLines: { what: `files longer than ${MAX_LINES} lines`, fix: 'Split the file by concern.' },
  longLines: { what: `lines longer than ${MAX_LINE} characters`, fix: 'Break the line up and name its parts.' },
  kindLists: { what: 'hand-written lists of fitting kinds', fix: 'Give the kinds a trait in src/domain/wardrobe/fittings.ts and use hasTrait(kind, trait).' },
  possessionLists: { what: 'hand-written lists of possessions', fix: 'Use POSSESSION_KEYS or POSSESSIONS from src/domain/wardrobe/possessions.ts.' },
  domainMarkup: { what: 'HTML markup in the domain layer', fix: 'Build markup in src/presentation; the domain returns data.' },
};

function measure(file) {
  const text = readFileSync(file, 'utf8'), lines = text.split('\n'), found = {};
  const add = (rule, line, detail) => (found[rule] ??= []).push(`${file}:${line} ${detail}`);
  if (lines.length > MAX_LINES) add('fileLines', lines.length, `${lines.length} lines`);
  lines.forEach((l, i) => { if (l.length > MAX_LINE) add('longLines', i + 1, `${l.length} characters`); });
  const at = index => text.slice(0, index).split('\n').length;
  if (!REGISTRY_FILES.has(file)) {
    for (const m of text.matchAll(/\[(\s*'[a-z]+'\s*(?:,\s*'[a-z]+'\s*)+)\]\.includes\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)) {
      const items = [...m[1].matchAll(/'([a-z]+)'/g)].map(x => x[1]);
      if (items.length >= 2 && items.every(i => kinds.includes(i)) && /(^|\.)k!?$|kind$|^k$/.test(m[2].trim())) add('kindLists', at(m.index), `[${items}]`);
    }
    for (const m of text.matchAll(/\[(\s*'[a-z]+'\s*(?:,\s*'[a-z]+'\s*){2,})\]/g)) {
      const items = [...m[1].matchAll(/'([a-z]+)'/g)].map(x => x[1]);
      if (items.filter(i => possessions.includes(i)).length >= 4 && items.every(i => possessions.includes(i))) add('possessionLists', at(m.index), `[${items}]`);
    }
  }
  if (file.startsWith('src/domain/')) for (const m of text.matchAll(/['"`][^'"`\n]*<(?:b|i|svg|span|div|small|strong|br)\b[^'"`\n]*['"`]/g)) add('domainMarkup', at(m.index), m[0].slice(0, 60));
  return found;
}

const errors = [];
let listed = 0;
for (const file of files) {
  const found = measure(file);
  for (const [rule, items] of Object.entries(found)) {
    const allowed = baseline[rule]?.[file] ?? 0, count = rule === 'fileLines' ? Number(items[0].split(' ')[1]) : items.length;
    if (report) items.forEach(i => console.log(`  ${rule}: ${i}`));
    if (allowed) listed++;
    if (count <= allowed) continue;
    const amount = rule === 'fileLines' ? `${count} lines, limit ${allowed || MAX_LINES}` : `${count} ${RULES[rule].what}${allowed ? `, limit ${allowed}` : ''}`;
    errors.push(`${file}: ${amount}. ${RULES[rule].fix}\n    ${items.slice(0, 3).join('\n    ')}`);
  }
}
for (const [rule, entries] of Object.entries(baseline)) {
  if (rule.startsWith('_')) continue;
  for (const file of Object.keys(entries)) if (!files.includes(file)) errors.push(`scripts/architecture-baseline.json lists ${file} under ${rule}, but it does not exist. Remove the entry.`);
}
if (errors.length) {
  console.error(`Architecture check failed:\n\n${errors.join('\n\n')}\n\nSee the rules at the top of scripts/check-architecture.mjs and in CLAUDE.md.`);
  process.exit(1);
}
console.log(`Architecture rules passed (${files.length} files; ${listed} older entries held at or below their baseline).`);
