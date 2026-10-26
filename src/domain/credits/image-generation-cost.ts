/**
 * What one AI image costs at Google, from token prices and token counts. docs/credits.md shows the working.
 *
 * Prices: gemini-nano-banana-2.1, standard paid tier, US dollars per million tokens (ai.google.dev pricing, October 2026).
 * Change them here when Google changes them or the model changes; the margin test then checks every pack again.
 */
export const IMAGE_MODEL_PRICES = {
  /** Text and images sent to the model. */
  input: 1.50,
  /** Text the model writes, thinking included. */
  textOutput: 7.50,
  /** The generated image. */
  imageOutput: 30.00,
} as const;

/** Tokens one input image counts for at the default media resolution. */
export const TOKENS_PER_INPUT_IMAGE = 1120;
/** Tokens a 2K output image counts for. */
export const TOKENS_PER_2K_IMAGE = 1680;

export interface ImageRequestTokens {
  /** Reference views (always 3) and decor swatches (up to 8). */
  readonly inputImages: number;
  /** System instruction, view labels and the design summary. */
  readonly inputText: number;
  /** `thinking_level: medium`: Google does not publish a figure, so these are estimates to check against the recorded usage. */
  readonly thinking: number;
  /** The short description returned with the image. */
  readonly answer: number;
  /** Attempts Google bills that we refund (no image, timeout, cancelled), as a share of paid images. */
  readonly failedShare: number;
}

/** Measured on the current prompts (October 2026): an ordinary wardrobe sends 3 views, 1 swatch and about 1,700 text
 * tokens. The worst case is a design with 8 finishes, a long summary, long thinking and one in five attempts failing. */
export const IMAGE_REQUEST_TOKENS = {
  typical: { inputImages: 4, inputText: 1700, thinking: 1000, answer: 200, failedShare: 0.10 },
  worst: { inputImages: 11, inputText: 5000, thinking: 6000, answer: 500, failedShare: 0.20 },
} as const satisfies Record<'typical' | 'worst', ImageRequestTokens>;

/** US dollars one delivered image costs, failed attempts included. */
export function imageGenerationCost(t: ImageRequestTokens, prices = IMAGE_MODEL_PRICES) {
  const input = (t.inputImages * TOKENS_PER_INPUT_IMAGE + t.inputText) * prices.input;
  const text = (t.thinking + t.answer) * prices.textOutput;
  const image = TOKENS_PER_2K_IMAGE * prices.imageOutput;
  return (input + text + image) / 1_000_000 * (1 + t.failedShare);
}
