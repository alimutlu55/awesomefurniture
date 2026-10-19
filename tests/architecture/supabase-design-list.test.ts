import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/infrastructure/supabase/database.types';
import { SupabaseProjectRepository } from '../../src/infrastructure/supabase/project-repository';

// Exercise the real client query builder against a deterministic transport, not a live user's records.
test('cloud design listing pages beyond 100 records and scopes every query to the owner', async () => {
  const requests: URL[] = [];
  const all = Array.from({ length: 205 }, (_, index) => ({
    id: `design-${index}`, name: `Design ${index}`, revision: index + 1, updated_at: '2026-10-19T12:00:00Z',
  }));
  const client = createClient<Database>('https://example.supabase.co', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      requests.push(url);
      assert.equal(url.searchParams.get('owner_id'), 'eq.owner');
      assert.equal(url.searchParams.get('deleted_at'), 'is.null');
      assert.equal(url.searchParams.get('order'), 'updated_at.desc,id.asc');
      const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 100);
      return new Response(JSON.stringify(all.slice(offset, offset + limit)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const rows = await new SupabaseProjectRepository(client, 'owner').list();
  assert.equal(rows.length, 205); assert.equal(rows.at(-1)?.id, 'design-204');
  assert.deepEqual(requests.map(url => url.searchParams.get('offset')), ['0', '100', '200']);
});
