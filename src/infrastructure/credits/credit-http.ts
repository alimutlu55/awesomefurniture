import { CreditError, type CreditErrorCode } from '../../application/credits/credit-service';
import { PaymentProviderError, PaymentSignatureError } from '../../application/credits/credit-ports';
import type { SpendReceipt } from '../../application/credits/credit-wallet';
import type { CreditRuntime } from './credit-environment';
import { testCheckoutPage, testCheckoutComplete } from './test-checkout-page';

const STATUS: Record<CreditErrorCode, number> = {
  UNKNOWN_PACK: 400, UNKNOWN_PROVIDER: 400, UNKNOWN_FEATURE: 400, INVALID_REQUEST: 400, SIGN_IN_REQUIRED: 401,
  INSUFFICIENT_CREDITS: 402, ACCOUNT_REQUIRED: 403, ORDER_NOT_FOUND: 404, RATE_LIMITED: 429, CREDITS_UNAVAILABLE: 503,
};
const MAX_BODY = 64 * 1024;

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const failure = (status: number, code: string, message: string, extra: object = {}) => json({ error: { code, message, ...extra } }, status);

/** A refused credit request as the browser receives it: the code and, when short of credits, what was needed. */
export function creditFailure(error: CreditError) {
  return failure(STATUS[error.code], error.code, error.message, error.detail);
}

/** Unexpected failures are logged with a request id and never show their message; the id is the person's support reference. */
function unexpected(event: string, error: unknown) {
  const requestId = crypto.randomUUID();
  console.error(JSON.stringify({ event, requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
  const response = failure(500, 'CREDITS_FAILED', 'Credits are temporarily unavailable. Please try again.', { reason: requestId });
  response.headers.set('X-Request-ID', requestId);
  return response;
}

async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new CreditError('INVALID_REQUEST', 'The request is too large.');
  return text;
}
async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw new CreditError('INVALID_REQUEST', 'Send JSON.');
  try {
    const value = JSON.parse(await readBody(request)) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch (error) { if (error instanceof CreditError) throw error; }
  throw new CreditError('INVALID_REQUEST', 'The request contains invalid JSON.');
}
const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return !(origin && origin !== new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
};
/** Only a path on this site: a checkout never returns anywhere else. */
function returnPath(value: unknown) {
  return typeof value === 'string' && /^\/(?!\/)[A-Za-z0-9/_.-]{0,120}$/.test(value) ? value : '/editor.html';
}

/** `/api/credits/*` and `/api/payments/*`. Null for any other path. */
export async function handleCredits(request: Request, runtime: CreditRuntime | null): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname;
  if (!path.startsWith('/api/credits') && !path.startsWith('/api/payments/')) return null;
  if (!runtime) return failure(503, 'CREDITS_UNAVAILABLE', 'Credits are temporarily unavailable. Please try again later.');
  const { service } = runtime;
  try {
    const webhook = /^\/api\/payments\/([a-z][a-z0-9-]{1,31})\/webhook$/.exec(path);
    if (webhook) {
      if (request.method !== 'POST') return failure(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
      try { return json({ received: true, result: await service.receive(webhook[1]!, await readBody(request), request.headers) }); }
      catch (error) {
        if (error instanceof PaymentSignatureError) return failure(400, 'INVALID_SIGNATURE', error.message);
        // Anything else answers 500, so the provider delivers the event again later.
        throw error;
      }
    }
    if (runtime.test && path === '/api/payments/test/checkout') return testCheckoutPage(url);
    if (runtime.test && path === '/api/payments/test/complete' && request.method === 'POST') return testCheckoutComplete(request, runtime);
    if (!sameOrigin(request)) return failure(403, 'ORIGIN_REJECTED', 'Use credits from the design editor.');
    const user = await runtime.authenticate(request);
    if (!user) throw new CreditError('SIGN_IN_REQUIRED', 'Your session has ended. Reload the page and try again.');

    if (path === '/api/credits' && request.method === 'GET') return json(await service.wallet(user));
    if (path === '/api/credits/checkout' && request.method === 'POST') {
      const body = await readJson(request), back = new URL(returnPath(body.returnTo), url.origin);
      const link = (outcome: string) => { const u = new URL(back); u.searchParams.set('checkout', outcome); u.searchParams.set('order', '{ORDER}'); return u.href.replace('%7BORDER%7D', '{ORDER}'); };
      return json(await service.checkout(user, { pack: body.pack, provider: body.provider, links: { success: link('success'), cancel: link('cancel') } }));
    }
    const order = /^\/api\/credits\/orders\/([0-9a-f-]{36})$/.exec(path);
    if (order && request.method === 'GET') return json(await service.confirm(user, order[1]));
    if (path === '/api/credits/spend' && request.method === 'POST') {
      const body = await readJson(request), spent = await service.spend(user, { feature: body.feature, key: body.key, scope: body.scope });
      const receipt: SpendReceipt = { charge: spent.charge!, cost: spent.cost, balance: spent.balance, passExpiresAt: spent.passExpiresAt };
      return json(receipt);
    }
    return failure(404, 'NOT_FOUND', 'Unknown credits endpoint.');
  } catch (error) {
    if (error instanceof CreditError) return creditFailure(error);
    if (error instanceof PaymentProviderError) {
      const requestId = crypto.randomUUID();
      console.error(JSON.stringify({ event: 'credits_provider_failed', requestId, path, reason: error.reason }));
      const response = failure(502, 'CHECKOUT_FAILED', 'We could not open the payment page. Please try again in a moment.', { reason: error.reason });
      response.headers.set('X-Request-ID', requestId);
      return response;
    }
    return unexpected('credits_request_failed', error);
  }
}
