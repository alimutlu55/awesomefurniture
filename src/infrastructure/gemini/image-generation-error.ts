export class ImageGenerationError extends Error {
  constructor(
    readonly status: number, readonly code: string, message: string, readonly providerStatus?: number,
    /** Google's canonical error status (e.g. `INVALID_ARGUMENT`) and a redacted, length-capped message. */
    readonly provider?: { reason: string | null; message: string | null },
  ) { super(message); }
}
