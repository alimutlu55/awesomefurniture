import { handleApi, sweepCredits, type ApiEnvironment } from './api-router';
import { withSecurityHeaders } from '../infrastructure/http/security-headers';
import { protectRequest, type RequestLimiter } from '../infrastructure/http/request-security';
import { safeError } from '../infrastructure/http/safe-error';

interface Environment extends ApiEnvironment {
  ASSETS: { fetch(request: Request): Promise<Response> };
  API_RATE_LIMITER: RequestLimiter;
}
export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    try {
      const response = await protectRequest(request, env.API_RATE_LIMITER)
        ?? await handleApi(request, env) ?? await env.ASSETS.fetch(request);
      return withSecurityHeaders(response);
    } catch (error) {
      const requestId = crypto.randomUUID();
      console.error(JSON.stringify({ event: 'worker_request_failed', requestId, error: safeError(error) }));
      return withSecurityHeaders(Response.json({ error: { code: 'SERVER_ERROR', message: 'Please try again later.', reason: requestId } },
        { status: 500, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId } }));
    }
  },
  async scheduled(_controller: unknown, env: Environment, context: { waitUntil(promise: Promise<unknown>): void }) {
    context.waitUntil(sweepCredits(env));
  },
};
