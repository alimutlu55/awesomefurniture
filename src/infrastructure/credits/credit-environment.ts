import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CreditUser, PaymentOrder, PaymentProvider } from '../../application/credits/credit-ports';
import { createCreditService, type CreditService } from '../../application/credits/credit-service';
import { PUBLIC_SUPABASE_PROJECT } from '../supabase/project-config';
import { createMemoryCreditStore } from './memory-credit-store';
import { createStripeProvider } from './stripe-provider';
import { createSupabaseCreditStore } from './supabase-credit-store';
import { createTestPaymentProvider } from './test-payment-provider';

/** Server settings for credits. Secrets are Worker secrets (`wrangler secret put`), never `VITE_` variables. */
export interface CreditEnvironment {
  /** `live` (the default): Supabase ledger and real payment providers. `test`: see createCreditRuntime. */
  CREDITS_MODE?: string | undefined;
  SUPABASE_URL?: string | undefined;
  /** A Supabase secret key (`sb_secret_…`): the ledger functions are granted to service_role only. */
  SUPABASE_SECRET_KEY?: string | undefined;
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_WEBHOOK_SECRET?: string | undefined;
  /** `false` lets guests buy without adding an email first. Default: an email is required. */
  CREDITS_REQUIRE_ACCOUNT?: string | undefined;
}

export interface CreditRuntime {
  readonly mode: 'live' | 'test';
  readonly service: CreditService;
  /** The person behind a request's bearer token, or null. */
  authenticate(request: Request): Promise<CreditUser | null>;
  /** Test mode only: the pretend checkout. */
  readonly test: (PaymentProvider & { secret: string; grant(userId: string, credits: number): void; order(id: string): Promise<PaymentOrder | null> }) | null;
}

const LOCAL_TEST_USER: CreditUser = { id: '00000000-0000-4000-8000-00000000c0de', anonymous: false, email: 'local-test@wardrobe-forge.invalid' };

function verifier(client: SupabaseClient) {
  return async (request: Request): Promise<CreditUser | null> => {
    const token = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return null;
    // getClaims verifies the signature with the project's public keys (or asks Auth for older symmetric keys).
    const { data, error } = await client.auth.getClaims(token);
    const claims = data?.claims;
    if (error || !claims?.sub || claims.role !== 'authenticated') return null;
    const email = typeof claims.email === 'string' && claims.email ? claims.email : null;
    return { id: claims.sub, anonymous: claims.is_anonymous === true || !email, email };
  };
}

let testRuntime: CreditRuntime | null = null;
const runtimes = new WeakMap<object, CreditRuntime | null>();

/**
 * Builds the credit service for this environment, once per Worker isolate. Returns null when credits are not
 * configured: paid features then answer 503 rather than running for free.
 *
 * Test mode keeps credits in memory and pays with a pretend checkout. Only the local dev server passes
 * `allowTest`; a deployed Worker never runs it, whatever its variables say.
 */
export function createCreditRuntime(env: CreditEnvironment, origin: string, { allowTest = false } = {}): CreditRuntime | null {
  if (env.CREDITS_MODE === 'test') {
    if (!allowTest) return null;
    if (testRuntime) return testRuntime;
    const store = createMemoryCreditStore(), provider = createTestPaymentProvider(origin);
    const auth = createClient(PUBLIC_SUPABASE_PROJECT.url, PUBLIC_SUPABASE_PROJECT.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const verify = verifier(auth);
    testRuntime = {
      mode: 'test',
      service: createCreditService({ store, providers: [provider], requireAccount: env.CREDITS_REQUIRE_ACCOUNT !== 'false' }),
      // Offline automated checks have no Supabase session: they act as one local person.
      authenticate: async request => request.headers.has('authorization') ? verify(request).catch(() => null) : LOCAL_TEST_USER,
      test: { ...provider, grant: store.grant, order: store.order },
    };
    return testRuntime;
  }
  if (runtimes.has(env)) return runtimes.get(env)!;
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) { runtimes.set(env, null); return null; }
  const client = createClient(env.SUPABASE_URL?.trim() || PUBLIC_SUPABASE_PROJECT.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const providers: PaymentProvider[] = [];
  if (env.STRIPE_SECRET_KEY?.trim() && env.STRIPE_WEBHOOK_SECRET?.trim()) {
    providers.push(createStripeProvider(env.STRIPE_SECRET_KEY.trim(), env.STRIPE_WEBHOOK_SECRET.trim()));
  }
  const runtime: CreditRuntime = {
    mode: 'live',
    service: createCreditService({ store: createSupabaseCreditStore(client), providers, requireAccount: env.CREDITS_REQUIRE_ACCOUNT !== 'false' }),
    authenticate: verifier(client),
    test: null,
  };
  runtimes.set(env, runtime);
  return runtime;
}
