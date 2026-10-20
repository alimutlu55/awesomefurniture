interface Lifetime { listen(target: EventTarget, type: string, listener: (event: Event) => void, options?: AddEventListenerOptions): void }
/** Native one-finger scrolling; intercept only two-finger pinch and Ctrl-wheel. Touch events survive native pointer cancellation. */
export function drawingGestures(viewport: HTMLElement, lifetime: Lifetime, getZoom: () => number, zoom: (level: number, focus: { x: number; y: number }) => void) {
  let pinch: { distance: number; zoom: number } | undefined;
  const spread = (touches: TouchList) => {
    const a = touches[0]!, b = touches[1]!;
    return { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  };
  lifetime.listen(viewport, 'touchstart', event => {
    const e = event as TouchEvent;
    if (e.touches.length !== 2) return;
    e.preventDefault(); pinch = { distance: spread(e.touches).distance, zoom: getZoom() };
  }, { passive: false });
  lifetime.listen(viewport, 'touchmove', event => {
    const e = event as TouchEvent;
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault(); const s = spread(e.touches), box = viewport.getBoundingClientRect();
    zoom(pinch.zoom * s.distance / Math.max(1, pinch.distance), { x: s.x - box.left, y: s.y - box.top });
  }, { passive: false });
  for (const type of ['touchend', 'touchcancel']) lifetime.listen(viewport, type, () => { pinch = undefined; });
  lifetime.listen(viewport, 'wheel', event => {
    const e = event as WheelEvent;
    if (!e.ctrlKey) return;
    e.preventDefault(); const box = viewport.getBoundingClientRect();
    zoom(getZoom() * Math.exp(-e.deltaY / 200), { x: e.clientX - box.left, y: e.clientY - box.top });
  }, { passive: false });
}
