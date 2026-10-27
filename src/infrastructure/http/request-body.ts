/** Counts bytes while reading, including requests with missing or dishonest Content-Length. */
export class RequestBodyError extends Error {
  constructor(readonly status: 400 | 413, message: string) { super(message); }
}

export async function readBoundedText(request: Request, maximum: number): Promise<string> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    throw new RequestBodyError(400, 'Invalid request length.');
  }
  if (length && Number(length) > maximum) throw new RequestBodyError(413, 'The request is too large.');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0, text = '', finished = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) { finished = true; break; }
      bytes += chunk.value.byteLength;
      if (bytes > maximum) throw new RequestBodyError(413, 'The request is too large.');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
