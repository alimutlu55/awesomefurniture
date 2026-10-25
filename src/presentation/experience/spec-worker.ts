import { buildFromSpec } from '../../application/spec/build-from-spec';
import type { DesignSpec } from '../../domain/spec/design-spec';

/** Builds a design from its spec off the page's thread: Auto design plans each wardrobe here, so the welcome's
 * build never freezes the page. The same builder an agent's spec uses. */
const scope = globalThis as unknown as { onmessage: ((e: MessageEvent<{ id: number; spec: DesignSpec }>) => void) | null; postMessage(message: unknown): void };
scope.onmessage = e => {
  const { id, spec } = e.data;
  try {
    scope.postMessage({ id, result: buildFromSpec(spec, 'welcome') });
  } catch {
    scope.postMessage({ id, result: null });
  }
};
