import type { CreditRuntime } from './credit-environment';

const escape = (value: string) => value.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const html = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
const local = (value: string | null, origin: string) => {
  try { const url = new URL(value ?? ''); return url.origin === origin ? url.href : null; } catch { return null; }
};

/** The pretend checkout page (test mode only): what a hosted provider page does, without taking money. */
export function testCheckoutPage(url: URL) {
  const order = url.searchParams.get('order') ?? '', success = local(url.searchParams.get('success'), url.origin), cancel = local(url.searchParams.get('cancel'), url.origin);
  if (!/^[0-9a-f-]{36}$/.test(order) || !success || !cancel) return html('<p>Unknown checkout.</p>', 400);
  const field = (name: string, value: string) => `<input type="hidden" name="${name}" value="${escape(value)}">`;
  const fields = field('order', order) + field('success', success) + field('cancel', cancel);
  return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test checkout</title><style>
:root{color-scheme:light dark;--bg:#f5f3ef;--card:#fff;--ink:#22201c;--muted:#6f6a62;--accent:#2f6b4f}
@media (prefers-color-scheme:dark){:root{--bg:#151412;--card:#201e1b;--ink:#f1ede6;--muted:#a59f95;--accent:#6fbf94}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif;padding:16px;box-sizing:border-box}
main{background:var(--card);border-radius:20px;padding:28px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.12)}
h1{font-size:20px;margin:0 0 4px}p{color:var(--muted);margin:0 0 20px}
button{width:100%;border:0;border-radius:12px;padding:14px;font:600 16px system-ui;cursor:pointer;margin-top:10px}
.pay{background:var(--accent);color:#fff}.cancel{background:transparent;color:var(--muted)}
.tag{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;background:#f3d36b;color:#3b2f00;border-radius:6px;padding:2px 8px;margin-bottom:12px}
</style></head><body><main><span class="tag">Test mode</span><h1>Test checkout</h1>
<p>No money is taken. Pay credits the order exactly as a real provider's webhook would.</p>
<form method="post" action="/api/payments/test/complete">${fields}<button class="pay" name="outcome" value="paid">Pay</button>
<button class="cancel" name="outcome" value="cancel">Cancel</button></form></main></body></html>`);
}

/** Completes a pretend checkout through the same signed-webhook path a real provider uses, then returns to the editor. */
export async function testCheckoutComplete(request: Request, runtime: CreditRuntime) {
  const origin = new URL(request.url).origin, form = await request.formData();
  const orderId = String(form.get('order') ?? ''), success = local(String(form.get('success')), origin), cancel = local(String(form.get('cancel')), origin);
  const order = runtime.test && /^[0-9a-f-]{36}$/.test(orderId) ? await runtime.test.order(orderId) : null;
  if (!order || !success || !cancel || !runtime.test) return html('<p>Unknown checkout.</p>', 400);
  if (form.get('outcome') !== 'paid') return Response.redirect(cancel, 303);
  const event = JSON.stringify({ id: 'test_evt_' + crypto.randomUUID(), outcome: 'paid', order: { id: order.id, amount: order.amount, currency: order.currency } });
  await runtime.service.receive('test', event, new Headers({ 'x-test-signature': runtime.test.secret }));
  return Response.redirect(success, 303);
}
