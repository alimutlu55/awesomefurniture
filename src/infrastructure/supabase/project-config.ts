/** Public browser connection settings. RLS enforces access; this is not a database secret.
 * Builds work without Cloudflare variables. Override both values together for another project. */
export const PUBLIC_SUPABASE_PROJECT = Object.freeze({
  url: "https://bcsdsuznpgnfyxzsaqzb.supabase.co",
  publishableKey: "sb_publishable_S7s4vb0vW3thRWVluxmkqg_o8ePuobR",
});

export function resolveSupabaseProject(url?: string, publishableKey?: string) {
  if (!url && !publishableKey) return PUBLIC_SUPABASE_PROJECT;
  if (!url || !publishableKey) throw new Error('Override both Supabase connection settings together.');
  if (!publishableKey.startsWith('sb_publishable_')) throw new Error('Use a Supabase publishable key for this browser app.');
  return { url, publishableKey };
}
