import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_SUPABASE_PROJECT, resolveSupabaseProject } from '../../src/infrastructure/supabase/project-config';

test('deployment has a public Supabase connection without environment variables', () => {
  const project = resolveSupabaseProject();
  assert.equal(project.url, 'https://bcsdsuznpgnfyxzsaqzb.supabase.co');
  assert.ok(project.publishableKey.startsWith('sb_publishable_'));
  assert.equal(Object.isFrozen(PUBLIC_SUPABASE_PROJECT), true);
});

test('another environment can override the complete connection without mixing projects', () => {
  assert.deepEqual(resolveSupabaseProject('https://other.supabase.co', 'sb_publishable_test'), {
    url: 'https://other.supabase.co', publishableKey: 'sb_publishable_test',
  });
  assert.throws(() => resolveSupabaseProject('https://other.supabase.co'), /both/);
  assert.throws(() => resolveSupabaseProject(undefined, 'sb_publishable_test'), /both/);
});

test('secret and legacy service-role keys cannot be configured in the browser', () => {
  assert.throws(() => resolveSupabaseProject('https://other.supabase.co', 'sb_secret_test'), /publishable/);
  assert.throws(() => resolveSupabaseProject('https://other.supabase.co', 'eyJ.service.role'), /publishable/);
});
