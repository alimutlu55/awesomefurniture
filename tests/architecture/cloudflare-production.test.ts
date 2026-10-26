import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import configureVite from '../../vite.config';

test('Cloudflare production builds select the production database without changing development or explicit overrides', async () => {
  assert.equal(typeof configureVite, 'function');
  if (typeof configureVite !== 'function') return;
  const directory = mkdtempSync(join(tmpdir(), 'furnidraw-production-'));
  const previousDirectory = process.cwd();
  const names = ['WORKERS_CI_BRANCH', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;
  const previous = names.map(name => process.env[name]);
  try {
    process.chdir(directory);
    for (const name of names) delete process.env[name];
    process.env.WORKERS_CI_BRANCH = 'main';
    const production = await configureVite({ command: 'build', mode: 'production' });
    assert.equal(production.define?.['import.meta.env.VITE_SUPABASE_URL'], JSON.stringify('https://yqeimymddjhqeghgpjcl.supabase.co'));
    assert.match(production.define?.['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY'] ?? '', /sb_publishable_/);

    for (const branch of ['develop', 'feature/example', undefined]) {
      if (branch) process.env.WORKERS_CI_BRANCH = branch;
      else delete process.env.WORKERS_CI_BRANCH;
      const development = await configureVite({ command: 'build', mode: 'production' });
      assert.equal(development.define?.['import.meta.env.VITE_SUPABASE_URL'], undefined);
    }

    process.env.WORKERS_CI_BRANCH = 'main';
    process.env.VITE_SUPABASE_URL = 'https://override.supabase.co';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_override';
    const overridden = await configureVite({ command: 'build', mode: 'production' });
    assert.equal(overridden.define?.['import.meta.env.VITE_SUPABASE_URL'], undefined, 'explicit Vite environment values retain precedence');
  } finally {
    process.chdir(previousDirectory);
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
    rmSync(directory, { recursive: true, force: true });
  }
});
