/** Public pages remain public; existing design/session/payment links retain their complete payload. */
export function editorEntry(href: string): string | null {
  const url = new URL(href);
  const carriesDesign = /(?:^#|&)(?:spec|design|access_token|refresh_token|error_description)=/.test(url.hash);
  const carriesSession = ['session', 'project', 'view', 'checkout', 'checkout_session_id', 'welcome', 'code', 'token_hash']
    .some(key => url.searchParams.has(key));
  if (!carriesDesign && !carriesSession) return null;
  url.pathname = '/editor/';
  return url.href;
}
