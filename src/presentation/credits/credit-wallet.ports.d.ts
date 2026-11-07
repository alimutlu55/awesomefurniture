import type { CreditsPlatform } from './credits.ports';
import type { TrackEvent } from '../../application/analytics/analytics-port';

export interface CreditWalletPorts {
  /** The editor's controls, and the page it is mounted in. */
  dom: { $(selector: string): HTMLElement; host: HTMLElement };
  lifetime: {
    listen(target: EventTarget, event: string, handler: (e: Event) => void): void;
    frame(callback: () => void): unknown;
    timeout(callback: () => void, delay: number): unknown;
    cleanup(callback: () => void): void;
  };
  platform: CreditsPlatform;
  /** The editor's short notice at the bottom of the screen. */
  toast(message: string): void;
  /** Closes the editor menu the Credits item sits in. */
  closeMenu?(): void;
  /** Opens signing in or creating an account: credits belong to an account (src/presentation/account). */
  signIn(): void;
  /** Product analytics: the wallet opening, packs chosen, credit gates. */
  track?: TrackEvent | undefined;
}
