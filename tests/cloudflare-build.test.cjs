const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('Cloudflare builds route main and develop independently and preserve the shared config', async () => {
  const { prepareCloudflareBuild } = await import('../scripts/prepare-cloudflare-build.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'wardrobe-cloudflare-'));
  const path = join(dir, 'wrangler.jsonc');
  const source = await readFile(join(__dirname, '../wrangler.jsonc'), 'utf8');
  try {
    await writeFile(path, source);
    await prepareCloudflareBuild('develop', path);
    const dev = await readFile(path, 'utf8');
    assert.match(dev, /"name": "awesomefurniture-dev"/);
    assert.equal(dev, source.replace('"name": "furnidraw-prod"', '"name": "awesomefurniture-dev"')
      .replace('https://yqeimymddjhqeghgpjcl.supabase.co', 'https://bcsdsuznpgnfyxzsaqzb.supabase.co'));
    await prepareCloudflareBuild('main', path);
    assert.equal(await readFile(path, 'utf8'), source);
    for (const branch of [undefined, 'feature/test', 'toString']) {
      await prepareCloudflareBuild(branch, path);
      assert.equal(await readFile(path, 'utf8'), source, 'local and preview builds keep their configuration');
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
