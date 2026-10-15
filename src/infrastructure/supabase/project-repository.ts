import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';
import { ProjectConflictError } from '../../application/ports/project-repository';
import type { ProjectRepository, StoredProject } from '../../application/ports/project-repository';
import type { ProjectDocument } from '../../domain/project/project';
import { parseProject, parseStoredProject } from '../serialization/project-codec';

const fields = 'document,revision,updated_at';
function record(row: { document: unknown; revision: number; updated_at: string }): StoredProject {
  return parseStoredProject({ document: row.document, revision: row.revision, updatedAt: new Date(row.updated_at).toISOString() });
}
function payload(document: ProjectDocument): Json {
  const value = JSON.stringify(parseProject(document));
  if (new TextEncoder().encode(value).length > 2 * 1024 * 1024) throw new Error('Design exceeds the 2 MiB save limit.');
  return JSON.parse(value) as Json;
}
export class SupabaseProjectRepository implements ProjectRepository {
  constructor(private readonly client: SupabaseClient<Database>, private readonly ownerId: string) {}

  async list() {
    const { data, error } = await this.client.from('design_sessions')
      .select('id,name,revision,updated_at').eq('owner_id', this.ownerId).is('deleted_at', null)
      .order('updated_at', { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data.map(row => ({ id: row.id, name: row.name!, revision: row.revision, updatedAt: new Date(row.updated_at).toISOString() }));
  }
  async load(id: string) {
    const { data, error } = await this.client.from('design_sessions').select(fields)
      .eq('id', id).eq('owner_id', this.ownerId).is('deleted_at', null).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? record(data) : null;
  }
  async save(document: ProjectDocument, expectedRevision: number | null) {
    const query = expectedRevision === null
      ? this.client.from('design_sessions').insert({ id: document.id, owner_id: this.ownerId, document: payload(document) })
      : this.client.from('design_sessions').update({ document: payload(document) })
        .eq('id', document.id).eq('owner_id', this.ownerId).eq('revision', expectedRevision).is('deleted_at', null);
    const { data, error } = await query.select(fields).maybeSingle();
    if (error?.code === '23505') throw new ProjectConflictError();
    if (error) throw new Error(error.message);
    if (!data) throw new ProjectConflictError();
    return record(data);
  }
  async delete(id: string, expectedRevision: number) {
    const { data, error } = await this.client.from('design_sessions').update({ deleted_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', this.ownerId).eq('revision', expectedRevision).is('deleted_at', null).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ProjectConflictError();
  }
  async visibility(id: string, revision: number, visibility: 'private' | 'public') {
    const { data, error } = await this.client.from('design_sessions').update({ visibility })
      .eq('id', id).eq('owner_id', this.ownerId).eq('revision', revision).is('deleted_at', null).select(fields).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ProjectConflictError();
    return record(data);
  }
}

export async function loadPublicSession(client: SupabaseClient<Database>, id: string) {
  const { data, error } = await client.from('design_sessions').select(`${fields},owner_id`)
    .eq('id', id).eq('visibility', 'public').is('deleted_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('This shared session is private, removed, or unavailable.');
  return { ...record(data), ownerId: data.owner_id };
}
