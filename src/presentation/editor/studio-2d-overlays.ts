/** A useful physical distance with a readable bar at any zoom, never wider than the viewport. */
export function planScale(zoom: number, width: number) {
  const target = Math.min(120, Math.max(40, width - 64));
  const desired = target / zoom, magnitude = 10 ** Math.floor(Math.log10(desired));
  const cm = [1, 2, 5, 10].map(n => n * magnitude).filter(n => n * zoom <= target).at(-1) ?? magnitude;
  return { cm, pixels: cm * zoom, label: cm >= 100 ? `${cm / 100} m` : `${cm} cm` };
}

/** Keep decorations above bottom tools and below top tools, including safe-area offsets. */
export function overlayInsets(viewport: DOMRect, toolbar: DOMRect, topTools: DOMRect) {
  const bottom = toolbar.width && toolbar.top > viewport.top + viewport.height / 2
    ? Math.min(viewport.height - 35, toolbar.top - viewport.top - 24) : viewport.height - 35;
  return { bottom, top: topTools.height ? topTools.bottom - viewport.top + 32 : 45 };
}

