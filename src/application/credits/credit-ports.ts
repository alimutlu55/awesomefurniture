/** The person a request comes from, read from a verified access token. */
export interface CreditUser {
  readonly id: string;
  /** An automatic guest identity with no email: credits could not be recovered on another device. */
  readonly anonymous: boolean;
  readonly email: string | null;
}

export type SpendStatus = 'reserved' | 'captured' | 'released' | 'insufficient';
export type SpendCharge = 'paid' | 'free' | 'pass';

export interface SpendResult {
  readonly status: SpendStatus;
  readonly spendId: string | null;
  readonly charge: SpendCharge | null;
  readonly cost: number;
  readonly balance: number;
  readonly passExpiresAt: string | null;
  /** The same idempotency key was used before: this is that first result. */
  readonly replay: boolean;
}

export interface SpendRequest {
  readonly userId: string;
  readonly feature: string;
  /** One key per attempt: repeating it (a retried request) never charges twice. */
  readonly key: string;
  readonly cost: number;
  readonly freeUses: number;
  readonly passHours: number;
  /** What a pass covers (a design id). */
  readonly scope: string | null;
  readonly capture: boolean;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'refunded' | 'partially_refunded' | 'disputed' | 'rejected';

export interface PaymentOrder {
  readonly id: string;
  readonly userId: string | null;
  readonly packId: string;
  readonly credits: number;
  /** Minor units (cents). */
  readonly amount: number;
  readonly currency: string;
  readonly provider: string;
  readonly providerRef: string | null;
  readonly status: OrderStatus;
  readonly createdAt: string;
}

export interface LedgerEntry {
  readonly id: number;
  readonly delta: number;
  readonly balanceAfter: number;
  readonly kind: 'purchase' | 'spend' | 'refund' | 'reversal' | 'restore' | 'grant';
  readonly feature: string | null;
  readonly description: string;
  readonly createdAt: string;
}

export interface CreditAccountSummary {
  readonly balance: number;
  /** Free uses taken, per feature. */
  readonly freeUsed: Readonly<Record<string, number>>;
  readonly passes: readonly { readonly feature: string; readonly scope: string; readonly expiresAt: string }[];
  readonly history: readonly LedgerEntry[];
}

/** A payment confirmed by a provider, to credit once. */
export interface PaymentCapture {
  readonly orderId: string;
  readonly provider: string;
  readonly providerRef: string;
  readonly paymentRef: string | null;
  readonly amount: number;
  readonly currency: string;
  readonly email: string | null;
}

/** Durable credit storage. Every write is idempotent and atomic (supabase/migrations/*_credits.sql). */
export interface CreditStore {
  summary(userId: string, history: number): Promise<CreditAccountSummary>;
  spend(request: SpendRequest): Promise<SpendResult>;
  settle(spendId: string, outcome: 'captured' | 'released', metadata?: Readonly<Record<string, string | number | boolean | null>>): Promise<void>;
  releaseStale(olderThanMinutes: number): Promise<number>;
  createOrder(input: { userId: string; packId: string; credits: number; amount: number; currency: string; provider: string; email: string | null }): Promise<PaymentOrder>;
  attachOrder(orderId: string, providerRef: string): Promise<void>;
  order(orderId: string): Promise<PaymentOrder | null>;
  orderByPayment(provider: string, paymentRef: string): Promise<PaymentOrder | null>;
  completeOrder(capture: PaymentCapture): Promise<'credited' | 'already' | 'mismatch' | 'unknown'>;
  adjustOrder(orderId: string, eventId: string, status: 'refunded' | 'disputed' | 'dispute_won', refundedAmount: number | null): Promise<void>;
  expireOrder(orderId: string): Promise<void>;
  /** False when the event was already processed: a replay to skip. */
  recordEvent(provider: string, eventId: string, type: string, orderId: string | null): Promise<boolean>;
  eventProcessed(provider: string, eventId: string): Promise<void>;
}

/** What a provider tells us happened to a payment, already verified (a signed webhook or a lookup). */
export type PaymentUpdate =
  | { readonly kind: 'paid'; readonly eventId: string; readonly capture: PaymentCapture }
  | { readonly kind: 'pending'; readonly eventId: string; readonly orderId: string }
  | { readonly kind: 'expired'; readonly eventId: string; readonly orderId: string }
  | { readonly kind: 'refunded'; readonly eventId: string; readonly paymentRef: string; readonly refundedAmount: number }
  | { readonly kind: 'disputed' | 'dispute_won'; readonly eventId: string; readonly paymentRef: string }
  | { readonly kind: 'ignored'; readonly eventId: string; readonly type: string };

export interface CheckoutLinks {
  /** Where the provider sends the person after paying; `{ORDER}` is replaced by the order id. */
  readonly success: string;
  readonly cancel: string;
}

/** One way to pay (Stripe, Paddle, a test checkout). A new provider is one implementation of this. */
export interface PaymentProvider {
  readonly id: string;
  /** Starts a hosted checkout for an order and says where to send the person. */
  checkout(order: PaymentOrder, links: CheckoutLinks, email: string | null, label: string): Promise<{ url: string; providerRef: string }>;
  /** Asks the provider what happened to an order: a backstop for a late or lost webhook. */
  lookup(order: PaymentOrder): Promise<PaymentUpdate | null>;
  /** Verifies and reads a webhook. Throws `PaymentSignatureError` when it is not genuinely from the provider. */
  webhook(body: string, headers: { get(name: string): string | null }): Promise<PaymentUpdate>;
}

export class PaymentSignatureError extends Error {
  constructor() { super('The payment notification signature is not valid.'); }
}
