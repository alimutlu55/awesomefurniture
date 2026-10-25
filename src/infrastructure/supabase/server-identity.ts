import type { SupabaseClient } from '@supabase/supabase-js';

/** A person proven by a Supabase access token. A guest identity has no email. */
export interface VerifiedUser {
  readonly id: string;
  readonly anonymous: boolean;
  readonly email: string | null;
}

/** The claims of a signed-in access token, after checking its signature. Null for anything else. */
export async function verifyAccessToken(client: SupabaseClient, token: string): Promise<VerifiedUser | null> {
  // getClaims verifies the signature with the project's public keys (or asks Auth for older symmetric keys).
  const { data, error } = await client.auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== 'authenticated') return null;
  const email = typeof claims.email === 'string' && claims.email ? claims.email : null;
  return { id: claims.sub, anonymous: claims.is_anonymous === true || !email, email };
}

/** The person behind a request's `Authorization: Bearer` token, or null. */
export function requestUser(client: SupabaseClient) {
  return async (request: Request): Promise<VerifiedUser | null> => {
    const token = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
    return token ? verifyAccessToken(client, token) : null;
  };
}
