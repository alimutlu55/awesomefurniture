/** Opt-in hosted integration check. Uses disposable users in a development project.
 * npx tsx scripts/verify-supabase.mts <development-project-ref> [--keep-users]
 * --cleanup removes users recorded by --keep-users after browser verification.
 * API credentials stay in this Node process and never enter the Vite client.
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/infrastructure/supabase/database.types';
import { SupabaseProjectRepository, loadPublicSession } from '../src/infrastructure/supabase/project-repository';
import { createProject } from '../src/domain/project/project';
import { sceneToProject } from '../src/application/projects/editor-mapper';
import { createEditorModel } from '../src/application/projects/editor-model';
import { ProjectConflictError } from '../src/application/ports/project-repository';

const ref = process.argv[2];
if (!ref || !/^[a-z]{20}$/.test(ref)) throw new Error('Supply a development project ref explicitly.');
const keysResult = spawnSync('npx', ['supabase', 'projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json'], { encoding: 'utf8' });
if (keysResult.status !== 0) throw new Error('CLI credential lookup failed. Sign in to the CLI first.');
const keys = JSON.parse(keysResult.stdout) as { type: string; api_key: string }[];
const secret = keys.find(key => key.type === 'secret')?.api_key;
const publishable = keys.find(key => key.type === 'publishable')?.api_key;
if (!secret || !publishable) throw new Error('Modern project API keys are required.');
const url = `https://${ref}.supabase.co`;
const client = (key: string) => createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(secret);
const fixturePath = '.env.supabase-test';
if (process.argv.includes('--cleanup')) {
  if (!existsSync(fixturePath)) throw new Error('No browser fixtures to clean up.');
  const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8')) as { projectRef: string; users: { id: string }[] };
  assert.equal(fixtures.projectRef, ref);
  for (const user of fixtures.users) {
    const { error } = await admin.auth.admin.deleteUser(user.id); if (error) throw error;
  }
  unlinkSync(fixturePath); console.log('Disposable browser accounts and their sessions removed.');
  process.exit(0);
}

const users: { id: string }[] = [];
let retain = false;
try {
  const owner = client(publishable); const follower = client(publishable); const visitor = client(publishable);
  for (const connection of [owner, follower]) {
    const { data, error } = await connection.auth.signInAnonymously();
    if (error) throw error;
    assert.equal(data.user?.is_anonymous, true);
    users.push({ id: data.user!.id });
  }
  // A returning browser restores the same identity, without creating an account again.
  const tokens = (await owner.auth.getSession()).data.session!;
  const returning = client(publishable);
  const restored = await returning.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
  assert.equal(restored.data.user?.id, users[0]!.id);
  const repository = new SupabaseProjectRepository(owner, users[0]!.id);
  const followerRepository = new SupabaseProjectRepository(follower, users[1]!.id);
  const document = sceneToProject(createProject(randomUUID(), 'Integration wardrobe'), createEditorModel().scene);
  const first = await repository.save(document, null);
  assert.deepEqual((await repository.load(document.id))?.document, first.document);
  await repository.save(createProject(randomUUID(), 'Second session'), null);
  assert.equal((await repository.list()).length, 2);
  const changed = await repository.save({ ...first.document, name: 'Updated wardrobe' }, 1);
  assert.equal(changed.revision, 2);
  await assert.rejects(repository.save(first.document, 1), ProjectConflictError);
  assert.equal(await followerRepository.load(document.id), null);
  await assert.rejects(loadPublicSession(visitor, document.id), /private/);
  const publicRecord = await repository.visibility(document.id, 2, 'public');
  assert.deepEqual((await loadPublicSession(visitor, document.id)).document, publicRecord.document);
  const write = await follower.from('design_sessions').update({ document: { ...JSON.parse(JSON.stringify(document)), name: 'Unauthorized' } })
    .eq('id', document.id).select('id');
  assert.equal(write.error, null); assert.deepEqual(write.data, []);
  const privateHistory = await follower.from('session_revisions').select('revision').eq('session_id', document.id);
  assert.deepEqual(privateHistory.data, []);
  const history = await owner.from('session_revisions').select('revision').eq('session_id', document.id);
  assert.equal(history.data?.length, 3);
  const follow = await follower.from('session_follows').insert({ follower_id: users[1]!.id, session_id: document.id });
  if (follow.error) throw follow.error;
  const follows = await follower.from('session_follows').select('session_id'); assert.equal(follows.data?.length, 1);
  const privateRecord = await repository.visibility(document.id, 3, 'private');
  await assert.rejects(loadPublicSession(visitor, document.id), /private/);
  await repository.delete(document.id, privateRecord.revision);
  assert.equal(await repository.load(document.id), null);
  console.log('PASS: automatic anonymous identity and restored browser session, complete design round-trip, multiple sessions, CAS, RLS, history, sharing, following, revocation and soft deletion.');
  if (process.argv.includes('--keep-users')) {
    writeFileSync(fixturePath, JSON.stringify({ projectRef: ref, users }, null, 2), { mode: 0o600 });
    retain = true; console.log('Temporary test accounts retained for browser verification; run --cleanup afterwards.');
  }
} finally {
  if (!retain) for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id); if (error) console.error('Fixture cleanup failed:', error.message);
  }
}
