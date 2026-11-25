import type { createEditorLifetime } from '../viewport/editor-lifetime.js';
import { ARROW_ICON } from './generate-image-dialog';
import { DesignImageUserError } from './design-image-errors';

const PLUS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

interface EmptyDesignPorts {
  readonly generate: HTMLButtonElement;
  readonly lifetime: Pick<ReturnType<typeof createEditorLifetime>, 'listen'>;
  /** Closes the dialog. */
  close(): void;
  /** Opens the editor's own Add furniture sheet; absent, the dialog keeps only its message. */
  readonly addFurniture?: (() => void) | undefined;
}

/**
 * A design with no furniture has nothing to picture. Instead of a Generate button that can only fail, the dialog offers
 * the way forward: Add furniture closes it and opens the editor's own Add sheet (half the dialog's openings in November
 * 2026 were on an empty design, and none of them went on to an image).
 */
export function bindEmptyDesign({ generate, lifetime, close, addFurniture }: EmptyDesignPorts) {
  const add = generate.ownerDocument.createElement('button');
  add.type = 'button';
  add.className = 'ai-generate-button ai-add-furniture';
  add.hidden = true;
  add.innerHTML = PLUS_ICON + '<span>Add furniture</span>' + ARROW_ICON;
  generate.after(add);
  lifetime.listen(add, 'click', () => { close(); addFurniture?.(); });
  return {
    /** Shows Add furniture in Generate's place while the design is empty. */
    show(empty: boolean) {
      const offer = empty && !!addFurniture;
      add.hidden = !offer;
      generate.hidden = offer;
      if (offer) add.focus();
    },
  };
}

/** The design had no furniture to picture when the dialog prepared it. */
export const isEmptyDesign = (error: unknown) => error instanceof DesignImageUserError && error.code === 'EMPTY_DESIGN';
