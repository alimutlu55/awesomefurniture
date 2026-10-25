import type { LedgerEntry, OrderStatus } from './credit-ports';

/** What `GET /api/credits` returns: everything the wallet shows, read in one request. */
export interface CreditWallet {
  readonly balance: number;
  readonly account: {
    readonly anonymous: boolean;
    readonly email: string | null;
    /** Buying needs a verified email (see createCreditService). */
    readonly required: boolean;
  };
  readonly features: readonly {
    readonly key: string; readonly label: string; readonly description: string;
    readonly unit: { readonly one: string; readonly many: string }; readonly icon: string;
    readonly cost: number; readonly passHours: number; readonly freeLeft: number;
  }[];
  readonly packs: readonly {
    readonly id: string; readonly label: string; readonly credits: number; readonly bonus: number; readonly total: number;
    readonly price: number; readonly currency: string; readonly featured: boolean; readonly saving: number;
  }[];
  readonly providers: readonly string[];
  readonly passes: readonly { readonly feature: string; readonly scope: string; readonly expiresAt: string }[];
  readonly history: readonly LedgerEntry[];
}

/** What `GET /api/credits/orders/:id` returns after checkout. */
export interface OrderConfirmation {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly credits: number;
  readonly balance: number;
}

/** What `POST /api/credits/spend` returns. */
export interface SpendReceipt {
  readonly charge: 'paid' | 'free' | 'pass';
  readonly cost: number;
  readonly balance: number;
  readonly passExpiresAt: string | null;
}
