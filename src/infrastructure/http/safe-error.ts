/** Unexpected messages can contain provider payloads or credentials. Keep only an error class and safe code. */
export function safeError(error: unknown): { type: string; code?: string } {
  const value = error as { name?: unknown; code?: unknown } | null;
  const type = typeof value?.name === 'string' && /^[A-Za-z]{1,48}$/.test(value.name) ? value.name : 'Error';
  const code = typeof value?.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(value.code) ? value.code : null;
  return code ? { type, code } : { type };
}
