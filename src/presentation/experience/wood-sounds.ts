/** The kind of sound a part makes as it lands: a carcass board, a fitting slid in, a door closing. */
export type Knock = 'board' | 'fitting' | 'door';

const VOICES: Record<Knock, { pitch: number; body: number; click: number; decay: number }> = {
  board: { pitch: 128, body: .2, click: .07, decay: .2 },
  fitting: { pitch: 310, body: .1, click: .05, decay: .1 },
  door: { pitch: 96, body: .15, click: .025, decay: .26 },
};

/**
 * Sounds of wood, made as they play (no recordings): a knock of a board landing, the click of a shelf slid home,
 * and a soft chord when everything fits. Quiet, and only after a person's own tap or click, as browsers require.
 */
export function createWoodSounds(view: { AudioContext?: typeof AudioContext } | null) {
  let context: AudioContext | null = null, noise: AudioBuffer | null = null, enabled = true, last = 0;
  function ready(): AudioContext | null {
    if (!enabled || !view?.AudioContext) return null;
    try {
      context ??= new view.AudioContext();
      if (context.state === 'suspended') void context.resume();
      if (!noise) {
        noise = context.createBuffer(1, Math.round(context.sampleRate * .06), context.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
      }
      return context;
    } catch {
      return null;
    }
  }
  function envelope(c: AudioContext, at: number, peak: number, decay: number) {
    const gain = c.createGain();
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, at + decay);
    gain.connect(c.destination);
    return gain;
  }
  /** A part landing. Close knocks merge, so a quick run of shelves never turns into noise. */
  function knock(kind: Knock) {
    const c = ready();
    if (!c || !noise) return;
    const now = c.currentTime;
    if (now - last < .045) return;
    last = now;
    const v = VOICES[kind], pitch = v.pitch * (.92 + Math.random() * .16);
    const tone = c.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(pitch, now);
    tone.frequency.exponentialRampToValueAtTime(pitch * .62, now + v.decay);
    tone.connect(envelope(c, now, v.body, v.decay));
    tone.start(now); tone.stop(now + v.decay + .02);
    const grain = c.createBufferSource(), filter = c.createBiquadFilter();
    grain.buffer = noise;
    filter.type = 'bandpass'; filter.frequency.value = 1400 + pitch * 3; filter.Q.value = 1.1;
    grain.connect(filter); filter.connect(envelope(c, now, v.click, .05));
    grain.start(now);
  }
  /** Everything has found its place: three soft, rising notes. */
  function fits() {
    const c = ready();
    if (!c) return;
    [523.25, 659.25, 783.99].forEach((f, k) => {
      const at = c.currentTime + k * .11, tone = c.createOscillator();
      tone.type = 'triangle';
      tone.frequency.value = f;
      tone.connect(envelope(c, at, .05, .9));
      tone.start(at); tone.stop(at + .95);
    });
  }
  return {
    knock, fits,
    setEnabled(on: boolean) { enabled = on; },
    enabled: () => enabled,
    dispose() { void context?.close().catch(() => {}); context = null; },
  };
}
