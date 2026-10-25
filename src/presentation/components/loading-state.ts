/** Component-local loading. Keep content and layout in place while a soft light sweeps over it.
 * Include loading-state.css in the component's shadow root (or page) alongside its own styles. */
export function createLoadingState(target: HTMLElement) {
  let active = false, previousBusy: string | null = null;
  return {
    get active() { return active; },
    start() {
      if (active) return;
      active = true;
      previousBusy = target.getAttribute('aria-busy');
      target.setAttribute('aria-busy', 'true');
      target.classList.add('ui-loading-surface');
    },
    stop() {
      if (!active) return;
      active = false;
      target.classList.remove('ui-loading-surface');
      if (previousBusy === null) target.removeAttribute('aria-busy');
      else target.setAttribute('aria-busy', previousBusy);
    },
  };
}

type PlaceholderLayout = 'design-list' | 'cards' | 'canvas' | 'lines';
type LoadingDocument = Pick<Document, 'createElement'>;

/** Content-shaped placeholders for the first fetch; never use these in place of an error or empty result. */
export function createLoadingPlaceholder(document: LoadingDocument, label: string, layout: PlaceholderLayout = 'lines') {
  const element = document.createElement('div');
  element.className = `ui-placeholder ui-placeholder--${layout} ui-loading-surface`;
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  const announcement = document.createElement('span');
  announcement.className = 'ui-loading-announcement'; announcement.textContent = label;
  const shapes = document.createElement('div');
  shapes.className = 'ui-placeholder-shapes'; shapes.setAttribute('aria-hidden', 'true');
  const count = layout === 'design-list' ? 4 : layout === 'cards' ? 3 : 1;
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div'); row.className = 'ui-placeholder-row';
    const image = document.createElement('span'); image.className = 'ui-placeholder-image';
    const copy = document.createElement('span'); copy.className = 'ui-placeholder-copy';
    for (let line = 0; line < 3; line++) {
      const bar = document.createElement('i'); bar.className = 'ui-placeholder-line'; copy.append(bar);
    }
    row.append(image, copy); shapes.append(row);
  }
  element.append(announcement, shapes);
  return element;
}

/** Yield through a paint before expensive synchronous work, so its loading surface is visible. */
export function paintLoading(target: HTMLElement): Promise<void> {
  const view = target.ownerDocument.defaultView;
  return new Promise(resolve => {
    if (!view || view.document.visibilityState === 'hidden') { resolve(); return; }
    view.requestAnimationFrame(() => view.setTimeout(resolve, 0));
  });
}
