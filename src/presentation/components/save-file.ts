/**
 * Hands a file the app made to the person: through the share sheet on a phone (Save to Files, Mail), downloaded
 * elsewhere. Resolves once it is handed over, or the share sheet is dismissed.
 */
export async function saveFile(page: Document, name: string, blob: Blob): Promise<void> {
  const win = page.defaultView, file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : null, nav = win?.navigator;
  if (file && nav?.canShare?.({ files: [file] }) && win?.matchMedia('(pointer: coarse)').matches) {
    try { await nav.share({ files: [file], title: name }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob), link = page.createElement('a');
  link.href = url; link.download = name; link.rel = 'noopener';
  page.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
