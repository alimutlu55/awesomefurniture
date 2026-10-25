import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import { handleApi, type ApiEnvironment } from '../src/app/api-router.ts';

/** The same `/api` handlers run in Vite dev/preview and in the deployed Worker. Only server code reads these keys.
 * Without SUPABASE_SECRET_KEY, credits run in test mode: kept in memory, paid with a pretend checkout (docs/credits.md). */
export function designImageDev(): Plugin {
  let environment: Omit<ApiEnvironment, 'AI_RATE_LIMITER'> = {};
  let windowEnd = 0, count = 0;
  const limiter = { async limit() {
    if (Date.now() > windowEnd) { count = 0; windowEnd = Date.now() + 60_000; }
    return { success: ++count <= 3 };
  } };
  async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (!req.url?.startsWith('/api/')) { next(); return; }
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', abort);
    try {
      const method = req.method ?? 'GET', headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      const init: RequestInit & { duplex: 'half' } = { method, headers, signal: controller.signal, duplex: 'half' };
      if (method !== 'GET' && method !== 'HEAD') init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
      const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, init);
      const result = await handleApi(request, { ...environment, AI_RATE_LIMITER: limiter }, { allowTest: true });
      if (!result) { next(); return; }
      res.statusCode = result.status;
      result.headers.forEach((value, key) => res.setHeader(key, value));
      if (result.status >= 300 && result.status < 400) { res.end(); return; }
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      if (!res.writableEnded) {
        res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'The image service is unavailable.' } }));
      }
    } finally { res.off('close', abort); }
  }
  return {
    name: 'design-image-api',
    configResolved(config) {
      const files = loadEnv(config.mode, config.envDir, ['GEMINI_', 'LOG_', 'AI_', 'CREDITS_', 'SUPABASE_', 'STRIPE_']);
      const read = (name: string) => process.env[name] || files[name];
      environment = {
        GEMINI_API_KEY: read('GEMINI_API_KEY'), LOG_LEVEL: read('LOG_LEVEL'), AI_MOCK_DELAY_MS: read('AI_MOCK_DELAY_MS'),
        SUPABASE_URL: read('SUPABASE_URL'), SUPABASE_SECRET_KEY: read('SUPABASE_SECRET_KEY'),
        STRIPE_SECRET_KEY: read('STRIPE_SECRET_KEY'), STRIPE_WEBHOOK_SECRET: read('STRIPE_WEBHOOK_SECRET'),
        CREDITS_MODE: read('CREDITS_MODE') || (read('SUPABASE_SECRET_KEY') ? 'live' : 'test'),
        CREDITS_REQUIRE_ACCOUNT: read('CREDITS_REQUIRE_ACCOUNT'),
      };
    },
    configureServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next); }); },
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next); }); },
  };
}
