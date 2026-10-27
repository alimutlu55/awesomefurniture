import { readBoundedText, RequestBodyError } from './request-body';

export interface RequestLimiter { limit(options: { key: string }): Promise<{ success: boolean }> }

/** Deliberately narrow: public /.well-known resources remain available. The build also rejects these files. */
export function sensitivePath(pathname: string): boolean {
  let path: string;
  try { path = decodeURIComponent(pathname).toLowerCase(); } catch { return true; }
  return /(?:^|\/)\.(?:env(?:[./-]|$)|git(?:[/-]|$)|aws(?:\/|$)|npmrc$|git-credentials$)/.test(path)
    || /(?:^|\/)(?:terraform\.tfstate(?:\..*)?|service[_-]?account(?:key)?\.json|gcp-credentials\.json)$/.test(path);
}

export async function protectRequest(request: Request, limiter: RequestLimiter): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (sensitivePath(path)) return new Response(null, { status: 404 });
  if (!path.startsWith('/api/')) return null;
  // Stripe retries signed server-to-server events; never subject it to browser challenges or visitor quotas.
  if (path === '/api/payments/stripe/webhook') return null;
  const key = 'api:ip:' + (request.headers.get('CF-Connecting-IP') ?? 'unknown');
  if (!(await limiter.limit({ key })).success) {
    return Response.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again in a minute.' } },
      { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
  }
  if (path !== '/api/security/csp-report') return null;
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  try {
    const report = JSON.parse(await readBoundedText(request, 16 * 1024)) as Record<string, unknown>;
    const body = report['csp-report'] as Record<string, unknown> | undefined;
    const directive = body?.['effective-directive'];
    if (typeof directive === 'string' && /^[a-z-]{1,48}$/.test(directive)) {
      // Reports are untrusted and may contain full URLs, tokens and private documents. Keep only a directive.
      console.info(JSON.stringify({ event: 'security_csp_violation', directive }));
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return new Response(null, { status: error instanceof RequestBodyError ? error.status : 400 });
  }
}
