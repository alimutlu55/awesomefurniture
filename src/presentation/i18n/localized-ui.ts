import { currentLanguage, onLanguageChange, translate } from './language';
const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'data-tip', 'alt'];
const OMIT = 'script,style,code,pre,textarea,[translate="no"],[data-user-content],[contenteditable]:not([contenteditable="false"])';
type Root = HTMLElement | ShadowRoot;
/** Localize the legacy imperative views at their DOM boundary. Canonical messages remain English in code.
 * Only text and accessibility copy change: IDs, values, event targets, geometry and project data do not.
 * User content must be marked translate=no. Ownership is explicit; callers dispose with their view. */
export function bindLocalizedUi(root: Root): () => void {
  const texts = new WeakMap<Text, { source: string; displayed: string }>();
  const attributes = new WeakMap<Element, Map<string, { source: string; displayed: string }>>();
  let stopped = false;
  const omitted = (element: Element | null) => !element || Boolean(element.closest(OMIT));
  function text(node: Text) {
    if (omitted(node.parentElement)) return;
    const old = texts.get(node), value = node.data;
    const source = old && value === old.displayed ? old.source : value;
    const displayed = translate(source);
    texts.set(node, { source, displayed });
    if (value !== displayed) node.data = displayed;
  }
  function element(node: Element) {
    if (omitted(node)) return;
    let saved = attributes.get(node);
    if (!saved) { saved = new Map(); attributes.set(node, saved); }
    for (const name of ATTRIBUTES) {
      if (node.getAttribute('data-i18n-preserve-attributes')?.split(' ').includes(name)) continue;
      const value = node.getAttribute(name); if (value === null) continue;
      const old = saved.get(name), source = old && value === old.displayed ? old.source : value;
      const displayed = translate(source); saved.set(name, { source, displayed });
      if (value !== displayed) node.setAttribute(name, displayed);
    }
  }
  function walk(node: Node) {
    if (node.nodeType === 3) { text(node as Text); return; }
    if (node.nodeType === 1) {
      const el = node as Element; if (omitted(el)) return; element(el);
    }
    for (const child of node.childNodes) walk(child);
  }
  const options = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES };
  const observer = new MutationObserver(records => {
    observer.disconnect();
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) walk(node);
      else if (record.type === 'characterData') text(record.target as Text);
      else element(record.target as Element);
    }
    if (!stopped) observer.observe(root, options);
  });
  const refresh = () => {
    observer.disconnect(); walk(root);
    const host = 'host' in root ? root.host : root; host.setAttribute('lang', currentLanguage());
    if (!stopped) observer.observe(root, options);
  };
  refresh();
  const unsubscribe = onLanguageChange(refresh);
  return () => { stopped = true; observer.disconnect(); unsubscribe(); };
}
