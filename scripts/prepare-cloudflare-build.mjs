import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Workers Builds provides the branch; change only its disposable build checkout.
 * Local builds keep the production default (use --env dev for local dev deploys).
 * Other branches keep the default for Cloudflare's preview deployment command. */
export async function prepareCloudflareBuild(branch, configPath = resolve('wrangler.jsonc')) {
  const name = branch === 'main' ? 'awesomefurniture' : branch === 'develop' ? 'awesomefurniture-dev' : null;
  if (!name) return;
  const source = await readFile(configPath, 'utf8');
  const next = source.replace(/^(\s*"name"\s*:\s*)"[^"]+"/m, `$1"${name}"`);
  if (next === source && !source.includes(`"name": "${name}"`)) throw new Error('Missing Worker name in wrangler.jsonc');
  if (next !== source) await writeFile(configPath, next);
  console.log(`Cloudflare branch ${branch}: ${name}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareCloudflareBuild(process.env.WORKERS_CI_BRANCH);
}
