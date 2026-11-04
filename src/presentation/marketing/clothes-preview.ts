import { mountEditor } from '../editor/mount-editor';
import { buildInBackground } from '../experience/spec-worker-client';
import { space, spaceSpec } from '../experience/spaces';
import { projectToScene } from '../../application/projects/editor-mapper';

export function mountPreview(root: HTMLElement) {
  const host = root.querySelector<HTMLElement>('.preview-host')!;
  const status = root.querySelector<HTMLElement>('.preview-status')!;
  const open = root.querySelector<HTMLButtonElement>('#preview-open')!;
  const inputs = Array.from(root.querySelectorAll('input'));
  const total = root.querySelector<HTMLOutputElement>('.preview-total')!;
  let editor: ReturnType<typeof mountEditor> | undefined;
  let revision = 0, timer = 0;
  async function build(id: number) {
    try {
      if (inputs.some(input => !input.validity.valid)) throw Error();
      const counts = Object.fromEntries(inputs.map(input => [input.name, input.valueAsNumber]));
      const result = await buildInBackground(spaceSpec(space('free'), counts));
      if (id !== revision) return;
      if (!result?.ok) throw Error();
      if (editor) editor.replaceDesign(result.project);
      else {
        editor = mountEditor({ root: host, initialScene: projectToScene(result.project), cameraPerspective: 'front' });
        const style = document.createElement('style');
        style.textContent = '[data-editor-id="app"] > :not([data-editor-id="view"]), [data-editor-id="view"] > :not(canvas){display:none!important}';
        host.shadowRoot!.append(style);
      }
      void editor.playAssembly();
      total.value = String(Object.values(counts).reduce((sum, count) => sum + count, 0));
      status.hidden = true;
      open.disabled = false;
    } catch {
      if (id !== revision) return;
      status.textContent = 'Enter a valid count for each category.';
      status.hidden = false;
    }
  }
  root.querySelectorAll<HTMLButtonElement>('[data-delta]').forEach(button => {
    const input = button.parentElement!.querySelector('input')!;
    button.addEventListener('click', () => {
      if (button.dataset.delta === '1') input.stepUp(); else input.stepDown();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  root.addEventListener('input', () => {
    open.disabled = true;
    const id = ++revision;
    clearTimeout(timer);
    timer = window.setTimeout(() => void build(id), 300);
  });
  open.addEventListener('click', async () => {
    if (!editor) return;
    const url = new URL('/editor/', location.href);
    url.searchParams.set('lang', document.documentElement.lang || 'en');
    const share = (window as unknown as { __furniShareLink?: (scene: any, href: string, name?: string) => Promise<string> }).__furniShareLink;
    if (share) {
      location.assign(await share(editor.scene(), url.href, 'My wardrobe'));
    } else {
      location.assign(url.href);
    }
  });
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry=>entry.isIntersecting)) { observer.disconnect(); void build(++revision); }
  });
  observer.observe(root);
}
