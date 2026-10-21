import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import { handleDesignImage } from '../src/infrastructure/gemini/design-image-handler.ts';

/** The same handler runs in Vite dev/preview and in the deployed Worker. Only server code reads this key. */
export function designImageDev(): Plugin {
  let apiKey: string | undefined;
  let windowEnd = 0, count = 0;
  const limiter = { async limit() {
    if (Date.now() > windowEnd) { count = 0; windowEnd = Date.now() + 60_000; }
    return { success: ++count <= 3 };
  } };
  async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.url?.split('?')[0] !== '/api/design-images') { next(); return; }
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
      const result = await handleDesignImage(request, { GEMINI_API_KEY: apiKey, AI_RATE_LIMITER: limiter });
      res.statusCode = result.status;
      result.headers.forEach((value, key) => res.setHeader(key, value));
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
    configResolved(config) { apiKey = process.env.GEMINI_API_KEY || loadEnv(config.mode, config.envDir, 'GEMINI_').GEMINI_API_KEY; },
    configureServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next); }); },
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next); }); },
  };
}
