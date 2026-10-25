/** The editor lifetime's calls the experience uses: every listener, timer, frame and observer is registered with
 * it, so disposing the editor removes them all. */
/** Anything that takes event listeners: an element, the page, the editor's document scope. */
export interface Listenable {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}
export interface ExperienceLifetime {
  listen(target: Listenable, type: string, handler: (e: Event) => void, options?: AddEventListenerOptions): void;
  observe<T extends { observe(target: Element, options?: unknown): void; disconnect(): void }>(observer: T, target: Element, options?: unknown): T | undefined;
  cleanup(fn: () => void): void;
  frame(fn: (now: number) => void): unknown;
  cancelFrame(id: unknown): void;
  timeout(fn: () => void, ms: number): unknown;
  cancelTimeout(id: unknown): void;
}

/** The editor's own document scope: elements made in the page, the focused control inside the editor, and
 * events within it. */
export interface ExperienceDocument extends Listenable {
  createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K];
  readonly activeElement: Element | null;
}
