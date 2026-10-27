import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { sensitivePath } from '../src/infrastructure/http/request-security';

/** Inspect the exact public directory Vite emits, not just tracked source files. Never print secret values. */
export async function auditPublicAssets(directory: string): Promise<void> {
  const failures: string[] = [];
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = join(current, entry.name), name = relative(directory, file).replaceAll('\\', '/');
      const hidden = name.split('/').some(part => part.startsWith('.') && part !== '.well-known');
      if (entry.isSymbolicLink() || hidden || sensitivePath('/' + name)
        || /\.(?:map|pem|key|p12|pfx|sql|bak|ts|tsx)$/i.test(name)) {
        failures.push(`${name}: forbidden public file`); continue;
      }
      if (entry.isDirectory()) { await walk(file); continue; }
      // Binary media is not executable; text and scripts are scanned, including encoded privileged JWTs.
      if (!/\.(?:js|mjs|cjs|json|html|css|txt|xml|svg)$/i.test(name)) continue;
      const text = await readFile(file, 'utf8');
      if (/sb_secret_[A-Za-z0-9_-]{16,}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) {
        failures.push(`${name}: server credential found`);
      }
      for (const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
        try {
          if (JSON.parse(Buffer.from(token[1]!, 'base64url').toString()).role === 'service_role') {
            failures.push(`${name}: privileged JWT found`);
          }
        } catch { /* not a JWT */ }
      }
    }
  }
  await walk(directory);
  if (failures.length) throw new Error('Public asset security check failed:\n' + failures.join('\n'));
}
