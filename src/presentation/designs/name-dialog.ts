export function createDesignDialog(document: Document, parent: ShadowRoot) {
  const style = document.createElement('style');
  style.textContent = `
    dialog{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;border:0;
      width:min(420px,calc(100% - 40px));max-height:calc(100dvh - 40px);overflow:auto;
      padding:25px;border-radius:22px;background:var(--panel);color:var(--ink)}
    dialog::backdrop{background:#30291f66}dialog h2{font-size:22px;font-weight:600;margin:0 0 18px;letter-spacing:-.5px}
    dialog p{font-size:13px;color:var(--mute);margin:0 0 20px;overflow-wrap:anywhere}
    dialog label{display:block;font-size:12px;margin-bottom:8px}dialog input{width:100%;font-size:16px;min-height:48px;
      border:1px solid var(--mute);border-radius:10px;padding:10px;background:var(--panel)}
    .validation{font-size:11px;color:var(--mute);margin-top:8px;min-height:18px}
    .dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:24px}
    dialog .destructive{background:#9c4034;color:#fff}
  `;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'design-dialog-title');
  const form = document.createElement('form');
  const title = document.createElement('h2'); title.id = 'design-dialog-title';
  const description = document.createElement('p');
  const field = document.createElement('div');
  const label = document.createElement('label'); label.htmlFor = 'design-name'; label.textContent = 'Design name';
  const input = document.createElement('input'); input.id = 'design-name'; input.maxLength = 120; input.autocomplete = 'off';
  input.setAttribute('aria-describedby', 'design-name-validation');
  const validation = document.createElement('div'); validation.id = 'design-name-validation'; validation.className = 'validation';
  const actions = document.createElement('div'); actions.className = 'dialog-actions';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
  const confirm = document.createElement('button'); confirm.type = 'submit'; confirm.className = 'primary';
  field.append(label, input, validation); actions.append(cancel, confirm); form.append(title, description, field, actions);
  dialog.append(form); parent.append(style, dialog);
  let resolve: ((value: string | null) => void) | null = null;
  let deleting = false;
  function finish(value: string | null) { dialog.close(); const done = resolve; resolve = null; done?.(value); }
  function validate() {
    const value = input.value.trim();
    confirm.disabled = !deleting && (!value || value.length > 120);
    input.setAttribute('aria-invalid', String(!deleting && !value));
    validation.textContent = value ? `${input.value.length} / 120 characters` : 'Enter a design name.';
  }
  input.addEventListener('input', validate);
  cancel.addEventListener('click', () => finish(null));
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
  form.addEventListener('submit', event => { event.preventDefault(); if (!confirm.disabled) finish(deleting ? 'delete' : input.value.trim()); });
  function resize() {
    const visual = document.defaultView?.visualViewport;
    dialog.style.top = visual ? `${visual.offsetTop + visual.height / 2}px` : '50%';
    dialog.style.maxHeight = visual ? `${visual.height - 32}px` : 'calc(100dvh - 40px)';
  }
  document.defaultView?.visualViewport?.addEventListener('resize', resize);
  document.defaultView?.visualViewport?.addEventListener('scroll', resize);
  return {
    open(mode: 'create' | 'rename' | 'delete', name: string): Promise<string | null> {
      if (resolve) return Promise.resolve(null);
      deleting = mode === 'delete';
      title.textContent = deleting ? 'Delete design?' : mode === 'create' ? 'New design' : 'Rename design';
      description.textContent = deleting ? `Delete “${name}”? Its shared link will stop opening.` : '';
      description.hidden = !deleting; field.hidden = deleting;
      confirm.textContent = deleting ? 'Delete' : mode === 'create' ? 'Create design' : 'Save name';
      confirm.classList.toggle('destructive', deleting); input.value = name; validate();
      const answer = new Promise<string | null>(done => { resolve = done; });
      dialog.showModal(); resize();
      if (deleting) cancel.focus(); else { input.focus(); input.select(); }
      return answer;
    },
    dispose() {
      if (resolve) finish(null);
      document.defaultView?.visualViewport?.removeEventListener('resize', resize);
      document.defaultView?.visualViewport?.removeEventListener('scroll', resize);
      dialog.remove(); style.remove();
    },
  };
}
