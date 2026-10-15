import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { resolveSupabaseProject } from './project-config';

export function createBrowserSupabase(url: string | undefined, key: string | undefined) {
  const project = resolveSupabaseProject(url, key);
  return createClient<Database>(project.url, project.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}
