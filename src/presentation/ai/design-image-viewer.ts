import type { createEditorDom } from '../editor/editor-dom';
import type { createEditorLifetime } from '../viewport/editor-lifetime.js';
import type { DesignImageRequest } from '../../application/projects/design-image';
import { renderCategory } from '../../application/projects/configuration-summary';
import { requestDesignImage, isDebugMode } from './design-image-client';
import { designImageErrorMessage } from './design-image-errors';
import { createDesignImageLoading } from './design-image-loading';
import { createDesignImageReferences } from './design-image-references';
import { loadDecorSwatches } from './decor-swatch-references';
import { IMAGE_STYLES, SPARKLE_ICON, ARROW_ICON, CLOSE_ICON, type ImageStyle } from './generate-image-dialog';
import type { CreditWalletApi } from '../credits/credit-wallet';
import { bindImageCredits } from './design-image-credits';

export { IMAGE_STYLES, type ImageStyle } from './generate-image-dialog';

interface Ports {
  dom: ReturnType<typeof createEditorDom>;
  lifetime: ReturnType<typeof createEditorLifetime>;
  capture(): DesignImageRequest;
  /** The wallet that pays for each image; absent, images are requested without credits. */
  credits?: CreditWalletApi | null;
}

type Phase = 'select' | 'closed' | 'generating' | 'result';

const TOOLBAR_SPARKLE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'
  + '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/></svg>';

export function bindDesignImageViewer({ dom, lifetime, capture, credits = null }: Ports) {
  const page = dom.host.ownerDocument;
  const button = page.createElement('button');
  button.type = 'button';
  button.className = 'tb ai-image-button';
  button.ariaLabel = 'Generate image with AI';
  button.title = 'Generate image with AI';
  button.innerHTML = TOOLBAR_SPARKLE + '<span>AI image</span>';
  dom.$('#topright').prepend(button);

  const overlay = page.createElement('div');
  overlay.className = 'ai-overlay';
  overlay.hidden = true;

  overlay.innerHTML = '<div class="ai-dialog" tabindex="-1" role="dialog" aria-modal="true" '
    + 'aria-labelledby="ai-dialog-title" aria-describedby="ai-dialog-desc" data-state="select">'
    + '<p class="ai-status" role="status" aria-live="polite"></p>'
    + `<button type="button" class="ai-close" aria-label="Close dialog">${CLOSE_ICON}</button>`
    + '<section class="ai-select-view">'
    + '<header class="ai-header">'
    + '<h2 id="ai-dialog-title">Generate image</h2>'
    + '<p id="ai-dialog-desc">Turn your design into a realistic image, as if it were already in your home.</p>'
    + '</header>'
    + '<div class="ai-style-list" role="radiogroup" aria-label="Image style">'
    + IMAGE_STYLES.map(({ value, title, description, thumbnail }, i) => {
      const active = i === 0;
      return `<button type="button" role="radio" data-style="${value}" aria-checked="${active}" tabIndex="${active ? 0 : -1}" `
        + `class="ai-style-option${active ? ' ai-style-option--selected' : ''}">`
        + `<img class="ai-style-thumbnail" src="${thumbnail}" alt="" />`
        + `<span class="ai-style-copy"><span class="ai-style-title">${title}</span>`
        + `<span class="ai-style-description">${description}</span></span>`
        + '<span class="ai-radio" aria-hidden="true"><span></span></span>'
        + '</button>';
    }).join('')
    + '</div>'
    + '<p class="ai-error" hidden></p>'
    + `<button type="button" class="ai-generate-button">${SPARKLE_ICON}<span>Generate image</span><span class="ai-cost" hidden></span>${ARROW_ICON}</button>`
    + '</section>'
    + '<section class="ai-result-view" hidden>'
    + '<figure class="ai-result-figure"><img alt="AI-generated photograph of your design"></figure>'
    + '<div class="ai-result-copy"><h2>Your design, brought to life</h2>'
    + '<p>AI visualization · Details may vary from your exact design.</p>'
    + '<p class="ai-model-text" hidden></p></div>'
    + '<p class="ai-result-error ai-error" hidden></p>'
    + '<div class="ai-result-actions">'
    + '<a class="ai-generate-button ai-download" download="design-ai.jpg" aria-label="Download image">Save Image</a>'
    + '<button type="button" class="ai-result-secondary ai-again">Try Again <span class="ai-cost" hidden></span></button>'
    + '</div>'
    + '</section>'
    + '</div>';

  dom.$('#app').append(overlay);

  const status = overlay.querySelector<HTMLElement>('.ai-status')!;
  const dialog = overlay.querySelector<HTMLElement>('.ai-dialog')!;
  const selectView = dialog.querySelector<HTMLElement>('.ai-select-view')!;
  const resultView = dialog.querySelector<HTMLElement>('.ai-result-view')!;
  const generate = selectView.querySelector<HTMLButtonElement>('.ai-generate-button')!;
  const selectError = selectView.querySelector<HTMLElement>('.ai-error')!;
  const resultError = resultView.querySelector<HTMLElement>('.ai-result-error')!;
  const resultImage = resultView.querySelector('img')!;
  const modelText = resultView.querySelector<HTMLElement>('.ai-model-text')!;
  const download = resultView.querySelector<HTMLAnchorElement>('.ai-download')!;
  const again = resultView.querySelector<HTMLButtonElement>('.ai-again')!;
  const radioGroup = selectView.querySelector<HTMLDivElement>('.ai-style-list')!;
  const styleButtons = Array.from(radioGroup.querySelectorAll<HTMLButtonElement>('.ai-style-option'));

  const debugPreviewEnabled = isDebugMode();
  const loading = createDesignImageLoading(page, lifetime, {
    isDebug: debugPreviewEnabled,
    onCancel: () => { cancel(); },
    onRestart: () => { void run(selectedStyle); },
  });
  dialog.append(loading.element);

  const references = createDesignImageReferences(page, debugPreviewEnabled);
  radioGroup.after(references.element);

  const pay = bindImageCredits({ credits, dialog, lifetime, reopen: () => { if (phase === 'closed') openModal('select'); } });
  let phase: Phase = 'closed';
  let selectedStyle: ImageStyle = 'realistic';
  let controller: AbortController | null = null;
  let imageUrl: string | null = null;
  let disposed = false;
  let prepared: DesignImageRequest | null = null;
  let preparation = 0;
  let originalOverflow = '';
  let previouslyFocused: HTMLElement | null = null;

  const releaseImage = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
  };

  function updateRadioSelection(style: ImageStyle, focusRadio = false) {
    selectedStyle = style;
    const index = IMAGE_STYLES.findIndex(s => s.value === style);
    styleButtons.forEach((btn, i) => {
      const active = i === index;
      btn.classList.toggle('ai-style-option--selected', active);
      btn.setAttribute('aria-checked', String(active));
      btn.tabIndex = active ? 0 : -1;
      if (active && focusRadio) btn.focus();
    });
  }

  function showSelectDialog() {
    phase = 'select';
    overlay.hidden = false;
    dialog.hidden = false;
    dialog.dataset.state = 'select';
    overlay.dataset.state = 'select';
    selectView.hidden = false;
    resultView.hidden = true;
    loading.element.hidden = true;
    references.element.hidden = !debugPreviewEnabled || !prepared;
    dialog.focus();
  }

  function showResultDialog() {
    phase = 'result';
    overlay.hidden = false;
    dialog.hidden = false;
    dialog.dataset.state = 'result';
    overlay.dataset.state = 'result';
    selectView.hidden = true;
    resultView.hidden = false;
    loading.element.hidden = true;
    references.element.hidden = true;
    dialog.classList.remove('is-revealing');
    void dialog.offsetWidth;
    dialog.classList.add('is-revealing');
    download.focus();
  }

  function showError(message: string | null) {
    const targetError = phase === 'result' ? resultError : selectError;
    targetError.hidden = !message;
    targetError.textContent = message ?? '';
    if (message) status.textContent = message;
  }

  function cancel() {
    controller?.abort();
    controller = null;
    loading.stop();
    showError(null);
    if (imageUrl) showResultDialog();
    else showSelectDialog();
  }

  function close() {
    preparation++;
    prepared = null;
    references.clear();
    controller?.abort();
    controller = null;
    loading.stop();
    phase = 'closed';
    overlay.hidden = true;
    dialog.hidden = true;
    showError(null);
    page.body.style.overflow = originalOverflow;
    previouslyFocused?.focus();
  }

  function openModal(initialPhase: 'select' | 'result' = imageUrl ? 'result' : 'select') {
    originalOverflow = page.body.style.overflow;
    previouslyFocused = document.activeElement as HTMLElement | null;
    page.body.style.overflow = 'hidden';
    showError(null);
    if (initialPhase === 'result' && imageUrl) showResultDialog();
    else showSelectDialog();
    void prepare();
  }

  async function prepare() {
    const current = ++preparation;
    prepared = null;
    references.clear();
    generate.disabled = true;
    status.textContent = 'Preparing reference images and JSON…';
    await new Promise<void>(resolve => lifetime.frame(() => lifetime.frame(() => resolve())));
    if (disposed || phase === 'closed' || current !== preparation) return;
    try {
      const captured = capture();
      const swatches = await loadDecorSwatches(captured.specification, AbortSignal.timeout(5000));
      if (current !== preparation || disposed || (phase as Phase) === 'closed') return;
      prepared = { ...captured, ...(swatches.length ? { decorSwatches: swatches } : {}) };
      references.update(prepared);
      showError(null);
      status.textContent = 'Reference images and JSON are ready to review.';
    } catch (error) {
      prepared = null;
      const message = designImageErrorMessage(error);
      showError(message);
    } finally {
      generate.disabled = false;
    }
  }

  async function run(style: ImageStyle = selectedStyle) {
    if (controller) return;
    if (!prepared) await prepare();
    if (!prepared || disposed || phase === 'closed') return;

    if (pay.short()) return;
    const category = renderCategory(prepared.specification);
    const stagingLevel: 1 | 2 | 3 = style === 'studio' ? 1 : style === 'concept' ? 3 : 2;
    const input: DesignImageRequest = {
      ...prepared,
      renderConfig: { category, stagingLevel },
    };

    const request = new AbortController();
    controller = request;
    phase = 'generating';
    dialog.dataset.state = 'generating';
    overlay.dataset.state = 'generating';
    selectView.hidden = true;
    resultView.hidden = true;
    showError(null);
    status.textContent = 'Creating your image. This usually takes about a minute.';
    loading.start();
    loading.cancel.focus();

    try {
      await new Promise<void>(resolve => lifetime.frame(() => lifetime.frame(() => resolve())));
      if (request.signal.aborted || disposed) return;
      loading.rendering();
      const output = await requestDesignImage(input, AbortSignal.any([request.signal, AbortSignal.timeout(180_000)]), await pay.headers());
      pay.paid(output);
      if (disposed || request.signal.aborted) return;
      const bytes = Uint8Array.from(atob(output.image.data), char => char.charCodeAt(0));
      releaseImage();
      imageUrl = URL.createObjectURL(new Blob([bytes], { type: output.image.mimeType }));
      resultImage.src = imageUrl;
      download.href = imageUrl;
      modelText.textContent = '';
      modelText.hidden = true;
      const ext = output.image.mimeType === 'image/jpeg' ? 'jpg' : output.image.mimeType.split('/')[1];
      download.download = `design-ai.${ext}`;
      loading.stop();
      showResultDialog();
      status.textContent = 'Your image is ready.';
    } catch (error) {
      if (disposed || request.signal.aborted) return;
      const message = designImageErrorMessage(error);
      loading.stop();
      if (pay.refused(error)) { if (imageUrl) showResultDialog(); else showSelectDialog(); return; }
      if (imageUrl) {
        showResultDialog();
        showError(message);
        again.focus();
      } else {
        showSelectDialog();
        showError(message);
        generate.focus();
      }
    } finally {
      if (controller === request) controller = null;
    }
  }

  function onRadioKeyDown(event: KeyboardEvent) {
    const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const selectedIndex = IMAGE_STYLES.findIndex(s => s.value === selectedStyle);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? IMAGE_STYLES.length - 1
      : (selectedIndex + delta + IMAGE_STYLES.length) % IMAGE_STYLES.length;
    updateRadioSelection(IMAGE_STYLES[nextIndex]!.value, true);
  }

  function handleFocusTrap(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const visibleFocusables = Array.from(focusables).filter(el => el.offsetParent !== null);
    if (!visibleFocusables.length) return;
    const first = visibleFocusables[0]!;
    const last = visibleFocusables[visibleFocusables.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  lifetime.listen(button, 'click', () => {
    if (phase !== 'closed') return;
    openModal();
  });

  lifetime.listen(overlay, 'mousedown', (event: MouseEvent) => {
    if (event.target === overlay) close();
  });

  overlay.querySelectorAll('.ai-close').forEach(closeBtn => {
    lifetime.listen(closeBtn, 'click', close);
  });

  styleButtons.forEach(btn => {
    lifetime.listen(btn, 'click', () => {
      const style = btn.dataset.style as ImageStyle;
      if (style) updateRadioSelection(style, true);
    });
  });

  lifetime.listen(radioGroup, 'keydown', (e: Event) => onRadioKeyDown(e as KeyboardEvent));

  lifetime.listen(generate, 'click', () => {
    void run(selectedStyle);
  });

  lifetime.listen(again, 'click', () => {
    void run(selectedStyle);
  });

  lifetime.listen(loading.cancel, 'click', () => {
    cancel();
    status.textContent = 'Image creation cancelled.';
  });

  const onGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
    if (phase === 'closed') return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    handleFocusTrap(event);
  };
  document.addEventListener('keydown', onGlobalKeyDown);

  lifetime.cleanup(() => {
    disposed = true;
    preparation++;
    controller?.abort();
    releaseImage();
    references.clear();
    prepared = null;
    document.removeEventListener('keydown', onGlobalKeyDown);
    page.body.style.overflow = originalOverflow;
    overlay.remove();
    button.remove();
  });

  return { close };
}
