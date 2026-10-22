import type { createEditorLifetime } from '../viewport/editor-lifetime.js';

// Light Orbit loader: borderless full-screen orbit animation with pointer parallax.
const art = `<div class="light-orbit-art" aria-hidden="true">
        <div class="light-orbit-ambient light-orbit-ambient-one"></div>
        <div class="light-orbit-ambient light-orbit-ambient-two"></div>
        <svg class="light-orbit-svg" viewBox="0 0 480 440" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="orbitTrailGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stop-color="#C3A4FF" stop-opacity="0.03" />
                <stop offset="0.39" stop-color="#E4D6FF" stop-opacity="0.33" />
                <stop offset="0.73" stop-color="#FFDEAF" stop-opacity="0.75" />
                <stop offset="1" stop-color="#FFC987" stop-opacity="0.15" />
              </linearGradient>
              <linearGradient id="orbitTrailViolet" x1="0" x2="1" y1="1" y2="0">
                <stop offset="0" stop-color="#8D71FF" stop-opacity="0.05" />
                <stop offset="0.29" stop-color="#B58FFF" stop-opacity="0.9" />
                <stop offset="0.62" stop-color="#E9D8FF" stop-opacity="0.38" />
                <stop offset="1" stop-color="#EFCAAA" stop-opacity="0.02" />
              </linearGradient>
              <linearGradient id="orbitProgressGold" x1="0" x2="1" y1="0" y2="0">
                <stop stop-color="#C1A3FF" />
                <stop offset="0.66" stop-color="#FFF3D3" />
                <stop offset="1" stop-color="#FFD29B" />
              </linearGradient>
              <radialGradient id="orbitPearl" cx="36%" cy="22%" r="87%">
                <stop offset="0" stop-color="#FFFBFF" />
                <stop offset="0.21" stop-color="#EAE1FF" />
                <stop offset="0.51" stop-color="#BDB0DA" />
                <stop offset="0.78" stop-color="#6C557D" />
                <stop offset="0.93" stop-color="#E6A98E" />
                <stop offset="1" stop-color="#FFE5CF" />
              </radialGradient>
              <radialGradient id="orbitInnerLight" cx="46%" cy="54%" r="54%">
                <stop offset="0" stop-color="#FFDFAE" stop-opacity="0.44" />
                <stop offset="0.6" stop-color="#FFDFAE" stop-opacity="0.03" />
                <stop offset="1" stop-color="#FFDFAE" stop-opacity="0" />
              </radialGradient>
              <filter id="orbitSoftGlow" x="-150%" y="-150%" width="400%" height="400%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
              <filter id="orbitStarGlow" x="-130%" y="-130%" width="360%" height="360%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <circle cx="240" cy="220" r="189" fill="none" stroke="#EDE4FF" stroke-opacity="0.09" stroke-width="0.8" />
            <circle cx="240" cy="220" r="145" fill="none" stroke="#DED5FF" stroke-opacity="0.18" stroke-width="0.8" stroke-dasharray="1 6" />
            <g class="light-orbit-spinner light-orbit-spinner-progress">
              <circle cx="240" cy="220" r="145" fill="none" stroke="url(#orbitProgressGold)" stroke-width="2.4" stroke-dasharray="100 811" stroke-linecap="round" transform="rotate(-90 240 220)" />
              <circle cx="240" cy="75" r="3.6" fill="#FFE4AF" filter="url(#orbitSoftGlow)" />
              <circle cx="240" cy="75" r="2.2" fill="#FFF5DD" />
            </g>
            <g class="light-orbit-spinner light-orbit-spinner-a">
              <g transform="rotate(-17 240 220)">
                <ellipse cx="240" cy="220" rx="206" ry="83" fill="none" stroke="url(#orbitTrailViolet)" stroke-width="1.25" />
                <circle cx="34" cy="220" r="10" fill="#9E71FF" opacity="0.5" filter="url(#orbitSoftGlow)" />
                <circle cx="34" cy="220" r="6" fill="#D6AAFF" />
                <circle cx="34" cy="220" r="2.6" fill="white" opacity="0.86" />
              </g>
            </g>
            <g class="light-orbit-spinner light-orbit-spinner-b">
              <g transform="rotate(24 240 220)">
                <ellipse cx="240" cy="220" rx="175" ry="70" fill="none" stroke="url(#orbitTrailGold)" stroke-width="1.15" />
                <circle cx="415" cy="220" r="9" fill="#FFE1A7" opacity="0.45" filter="url(#orbitSoftGlow)" />
                <circle cx="415" cy="220" r="5.2" fill="#FFE1B4" />
              </g>
            </g>
            <circle cx="240" cy="220" r="108" fill="#AC8DFF" opacity="0.075" filter="url(#orbitSoftGlow)" />
            <circle cx="240" cy="220" r="80" fill="#EBBDFF" opacity="0.12" filter="url(#orbitSoftGlow)" />
            <circle cx="240" cy="220" r="75" fill="url(#orbitPearl)" stroke="#F7E9FE" stroke-opacity="0.63" stroke-width="1.35" />
            <circle cx="240" cy="220" r="73" fill="url(#orbitInnerLight)" />
            <path d="M184 175 A65 65 0 0 1 267 152" stroke="#FFFFFF" stroke-opacity="0.42" stroke-width="2.5" fill="none" stroke-linecap="round" />
            <path d="M192 272 A69 69 0 0 0 290 269" stroke="#FFD5B0" stroke-opacity="0.42" stroke-width="1.6" fill="none" stroke-linecap="round" />
            <path d="M240 188 C246 210 251 214 272 220 C251 226 246 230 240 252 C234 230 229 226 208 220 C229 214 234 210 240 188Z" fill="#FFD3A1" opacity="0.93" filter="url(#orbitStarGlow)" />
            <path d="M240 188 C246 210 251 214 272 220 C251 226 246 230 240 252 C234 230 229 226 208 220 C229 214 234 210 240 188Z" fill="#FFF9E9" />
            <g fill="#FFF5E6">
              <circle class="light-orbit-twinkle light-orbit-twinkle-1" cx="243" cy="23" r="2.4" />
              <circle class="light-orbit-twinkle light-orbit-twinkle-2" cx="395" cy="130" r="1.9" />
              <circle class="light-orbit-twinkle light-orbit-twinkle-3" cx="97" cy="98" r="1.7" />
              <circle class="light-orbit-twinkle light-orbit-twinkle-4" cx="412" cy="333" r="1.4" />
              <circle class="light-orbit-twinkle light-orbit-twinkle-2" cx="71" cy="298" r="1.4" />
              <circle cx="246" cy="412" r="0.95" opacity="0.5" />
              <circle cx="135" cy="358" r="0.95" opacity="0.5" />
            </g>
          </svg>
      </div>`;
const preparing = 'Getting your design ready…';
const captions = [
  'Setting the scene…',
  'Composing the perfect shot…',
  'Balancing natural light…',
  'Refining materials and textures…',
  'Adding the finishing touches…',
];

/**
 * Decorative waiting experience. It never shows technical inputs (reference views, JSON):
 * the viewer owns the accessible status, the request and cancellation.
 */
export function createDesignImageLoading(page: Document, lifetime: ReturnType<typeof createEditorLifetime>) {
  const element = page.createElement('div');
  element.className = 'light-orbit-screen ai-magic'; element.hidden = true; element.dataset.phase = 'generating';
  element.innerHTML = `<div class="light-orbit-backdrop" aria-hidden="true"></div>
    <section class="light-orbit-content">
      ${art}
      <div class="light-orbit-copy">
        <h1 class="light-orbit-heading">Creating your image</h1>
        <p class="light-orbit-status ai-magic-caption" aria-hidden="true">${preparing}</p>
        <p class="light-orbit-caption ai-magic-wait">Usually about a minute.</p>
      </div>
      <div class="light-orbit-controls"><button type="button" class="light-orbit-action ai-cancel">Cancel</button></div>
    </section>`;
  const caption = element.querySelector<HTMLElement>('.ai-magic-caption')!;
  const wait = element.querySelector<HTMLElement>('.ai-magic-wait')!;
  const cancel = element.querySelector<HTMLButtonElement>('.ai-cancel')!;
  let timer: ReturnType<typeof lifetime.timeout> | undefined;
  let longWaitTimer: ReturnType<typeof lifetime.timeout> | undefined;
  let parallax: (() => void) | undefined;
  function show(text: string) { caption.textContent = text; }
  function trackPointer() {
    const win = page.defaultView;
    if (!win || win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (event: PointerEvent) => {
      element.style.setProperty('--orbit-parallax-x', `${((event.clientX / win.innerWidth - .5) * 2 * 9).toFixed(2)}px`);
      element.style.setProperty('--orbit-parallax-y', `${((event.clientY / win.innerHeight - .5) * 2 * 7).toFixed(2)}px`);
    };
    const reset = () => {
      element.style.setProperty('--orbit-parallax-x', '0px'); element.style.setProperty('--orbit-parallax-y', '0px');
    };
    win.addEventListener('pointermove', move, { passive: true });
    win.addEventListener('pointerleave', reset);
    parallax = () => { win.removeEventListener('pointermove', move); win.removeEventListener('pointerleave', reset); reset(); };
  }
  function stop() {
    if (timer !== undefined) lifetime.cancelTimeout(timer);
    if (longWaitTimer !== undefined) lifetime.cancelTimeout(longWaitTimer);
    timer = undefined; longWaitTimer = undefined; element.hidden = true;
    parallax?.(); parallax = undefined;
    element.classList.remove('is-rendering');
  }
  function start() {
    stop(); element.hidden = false; show(preparing);
    wait.textContent = 'Usually about a minute.'; trackPointer();
  }
  /** Called once the design has been captured and the request is in flight. */
  function rendering() {
    element.classList.add('is-rendering');
    let index = 0;
    show(captions[index]!);
    const rotate = () => {
      index = (index + 1) % captions.length; show(captions[index]!);
      timer = lifetime.timeout(rotate, 5_000);
    };
    timer = lifetime.timeout(rotate, 5_000);
    longWaitTimer = lifetime.timeout(() => {
      wait.textContent = 'Almost there. Beautiful images can take a little longer.';
    }, 60_000);
  }
  lifetime.cleanup(stop);
  return { element, cancel, start, rendering, stop };
}
