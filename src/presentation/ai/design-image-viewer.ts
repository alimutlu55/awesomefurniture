import type { createEditorDom } from '../editor/editor-dom';
import type { createEditorLifetime } from '../viewport/editor-lifetime.js';
import type { DesignImageRequest } from '../../application/projects/design-image';
import { requestDesignImage } from './design-image-client';
import { designImageErrorMessage } from './design-image-errors';
import { createDesignImageLoading } from './design-image-loading';
import { createDesignImageReferences } from './design-image-references';

interface Ports {
  dom: ReturnType<typeof createEditorDom>; lifetime: ReturnType<typeof createEditorLifetime>;
  capture(): DesignImageRequest;
}
type State = 'intro' | 'generating' | 'result';

const sparkle = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/></svg>';
const star = '<path d="M32 2C35 23 41 29 62 32C41 35 35 41 32 62C29 41 23 35 2 32C23 29 29 23 32 2Z"/>';
const icon = (path: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const features = [
  [icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    'Natural light', 'Lit and styled like a professional photo shoot.'],
  [icon('<path d="M4 20V8l8-5 8 5v12"/><path d="M9 20v-6h6v6"/>'),
    'True to your design', 'Your layout, sizes and finishes, beautifully rendered.'],
  [icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    'Ready in about a minute', 'Keep it, share it, or try another take.'],
] as const;

export function bindDesignImageViewer({ dom, lifetime, capture }: Ports) {
  const page = dom.host.ownerDocument, button = page.createElement('button');
  button.type = 'button'; button.className = 'tb ai-image-button'; button.ariaLabel = 'Generate image with AI';
  button.title = 'Generate image with AI'; button.innerHTML = sparkle + '<span>AI image</span>';
  dom.$('#topright').prepend(button);
  const dialog = page.createElement('dialog'); dialog.className = 'ai-image-dialog';
  dialog.ariaLabel = 'Generate image with AI'; dialog.dataset.state = 'intro';
  dialog.innerHTML = `<button type="button" class="ai-close" aria-label="Close AI image">${icon('<path d="M6 6l12 12M18 6 6 18"/>')}</button>
    <p class="ai-status" role="status" aria-live="polite"></p>
    <section class="ai-intro">
      <div class="ai-hero" aria-hidden="true"><div class="ai-hero-glow"></div><div class="ai-hero-icon"><svg viewBox="0 0 64 64">${star}</svg></div></div>
      <h2>Bring your design to life</h2>
      <p class="ai-lede">Turn your design into a photorealistic image, as if it were already in your home.</p>
      <ul class="ai-features">${features.map(([glyph, title, text]) =>
        `<li><span class="ai-feature-icon">${glyph}</span><div><strong>${title}</strong><span>${text}</span></div></li>`).join('')}</ul>
      <p class="ai-error" hidden></p>
      <div class="ai-actions">
        <button type="button" class="ai-button ai-primary ai-generate">Generate Image</button>
        <button type="button" class="ai-button ai-plain ai-dismiss">Not Now</button>
      </div>
      <p class="ai-fineprint">Created with Google Gemini. AI images are visualizations and may differ from exact details.</p>
    </section>
    <section class="ai-result" hidden>
      <figure><img alt="AI-generated photograph of your design"></figure>
      <div class="ai-result-copy"><h2>Your design, brought to life</h2>
        <p>AI visualization · Details may vary from your exact design.</p></div>
      <div class="ai-actions ai-actions-row">
        <a class="ai-button ai-primary ai-download" download="design-ai.jpg" aria-label="Download image">Save Image</a>
        <button type="button" class="ai-button ai-secondary ai-again">Try Again</button>
      </div>
    </section>`;
  dom.$('#app').append(dialog);
  const loading = createDesignImageLoading(page, lifetime);
  const references = createDesignImageReferences(page);
  dialog.querySelector('.ai-features')!.before(references.element);
  dialog.querySelector('.ai-intro')!.after(loading.element);
  const status = dialog.querySelector<HTMLElement>('.ai-status')!;
  const errorText = dialog.querySelector<HTMLElement>('.ai-error')!;
  const generate = dialog.querySelector<HTMLButtonElement>('.ai-generate')!;
  const result = dialog.querySelector<HTMLElement>('.ai-result')!;
  const resultImage = result.querySelector('img')!;
  const download = dialog.querySelector<HTMLAnchorElement>('.ai-download')!;
  const sections: Record<State, HTMLElement> = { intro: dialog.querySelector('.ai-intro')!, generating: loading.element, result };
  let controller: AbortController | null = null, imageUrl: string | null = null, disposed = false;
  let prepared: DesignImageRequest | null = null, preparation = 0;
  const again = dialog.querySelector<HTMLButtonElement>('.ai-again')!;
  const releaseImage = () => { if (imageUrl) URL.revokeObjectURL(imageUrl); imageUrl = null; };
  function show(state: State) {
    dialog.dataset.state = state;
    for (const [name, section] of Object.entries(sections)) section.hidden = name !== state;
    if (state !== 'generating') {
      const anchor = state === 'intro' ? dialog.querySelector('.ai-features')! : result.querySelector('.ai-actions')!;
      anchor.before(references.element);
      sections[state].querySelector('.ai-actions')!.before(errorText);
    }
    references.element.hidden = state === 'generating' || !prepared;
    dialog.scrollTop = 0;
  }
  function showError(message: string | null) {
    errorText.hidden = !message; errorText.textContent = message ?? '';
  }
  /** Stops a pending request; a previous image stays available. */
  function cancel() {
    controller?.abort(); controller = null; loading.stop();
    showError(null); show(imageUrl ? 'result' : 'intro');
  }
  function close() {
    preparation++; prepared = null; references.clear();
    cancel(); dialog.close(); button.focus();
  }
  async function prepare() {
    const current = ++preparation;
    prepared = null; references.clear(); generate.disabled = again.disabled = true;
    status.textContent = 'Preparing reference images and JSON…';
    // Paint the dialog before capturing the high-resolution views.
    await new Promise<void>(resolve => lifetime.frame(() => lifetime.frame(() => resolve())));
    if (disposed || !dialog.open || current !== preparation) return;
    try {
      prepared = capture(); references.update(prepared);
      showError(null); status.textContent = 'Reference images and JSON are ready to review.';
    } catch (error) {
      prepared = null;
      const message = designImageErrorMessage(error); showError(message); status.textContent = message;
    } finally { generate.disabled = again.disabled = false; }
  }
  async function run() {
    if (controller) return;
    if (!prepared) await prepare();
    if (!prepared || disposed || !dialog.open) return;
    const input = prepared;
    const request = new AbortController(); controller = request;
    showError(null); status.textContent = 'Creating your image. This usually takes about a minute.';
    loading.start(); show('generating'); loading.cancel.focus();
    try {
      // Let the waiting state paint before starting the request.
      await new Promise<void>(resolve => lifetime.frame(() => lifetime.frame(() => resolve())));
      if (request.signal.aborted || disposed) return;
      loading.rendering();
      const output = await requestDesignImage(input, AbortSignal.any([request.signal, AbortSignal.timeout(180_000)]));
      if (disposed || request.signal.aborted) return;
      const bytes = Uint8Array.from(atob(output.image.data), char => char.charCodeAt(0));
      releaseImage(); imageUrl = URL.createObjectURL(new Blob([bytes], { type: output.image.mimeType }));
      resultImage.src = imageUrl; download.href = imageUrl;
      download.download = `design-ai.${output.image.mimeType === 'image/jpeg' ? 'jpg' : output.image.mimeType.split('/')[1]}`;
      result.classList.remove('is-revealing'); void result.offsetWidth; result.classList.add('is-revealing');
      loading.stop(); show('result'); status.textContent = 'Your image is ready.';
      download.focus();
    } catch (error) {
      if (disposed || request.signal.aborted) return;
      const message = designImageErrorMessage(error);
      loading.stop(); showError(message); status.textContent = message;
      generate.textContent = 'Try Again'; show(imageUrl ? 'result' : 'intro'); (imageUrl ? again : generate).focus();
    } finally {
      if (controller === request) controller = null;
    }
  }
  lifetime.listen(button, 'click', () => {
    if (dialog.open) return;
    // Opening never starts a paid generation: the customer chooses to generate.
    show(controller ? 'generating' : imageUrl ? 'result' : 'intro');
    dialog.showModal();
    void prepare();
    (controller ? loading.cancel : imageUrl ? download : generate).focus();
  });
  lifetime.listen(generate, 'click', () => { void run(); });
  lifetime.listen(dialog.querySelector('.ai-again')!, 'click', () => { void run(); });
  lifetime.listen(dialog.querySelector('.ai-dismiss')!, 'click', close);
  lifetime.listen(loading.cancel, 'click', () => { cancel(); status.textContent = 'Image creation cancelled.'; });
  lifetime.listen(dialog.querySelector('.ai-close')!, 'click', close);
  lifetime.listen(dialog, 'cancel', (event: Event) => { event.preventDefault(); close(); });
  lifetime.listen(dialog, 'keydown', (event: Event) => { event.stopPropagation(); });
  lifetime.cleanup(() => {
    disposed = true; preparation++; controller?.abort(); releaseImage(); references.clear(); prepared = null;
    dialog.remove(); button.remove();
  });
  return { close };
}
