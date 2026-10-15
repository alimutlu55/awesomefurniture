import { sceneToProject } from '../application/projects/editor-mapper';
import type { EditorScene } from '../application/projects/editor-scene';
import { createProject, type ProjectDocument } from '../domain/project/project';
import { deserializeProject, serializeProject } from '../infrastructure/serialization/project-codec';

/**
 * Share links: the whole design travels in the link (`#design=`), so people share a design, or send it to
 * themselves on another device, with nothing stored anywhere. The project document is compressed
 * (deflate-raw, about 2 KB for a furnished room) and written as base64url. What follows `#` never reaches
 * the server. Opening checks the document with the project codec like any saved design.
 */
const KEY = 'design';

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());
}
const toBase64Url = (bytes: Uint8Array) => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (code: string) => Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

/** A link that opens this design: the page's address with the design in its `#`. */
export async function designLink(scene: EditorScene, href: string, name = 'Shared design'): Promise<string> {
  const project = sceneToProject(createProject('shared', name), scene);
  const packed = await through(new TextEncoder().encode(serializeProject(project)), new CompressionStream('deflate-raw'));
  const url = new URL(href);
  url.searchParams.delete('session');
  url.searchParams.delete('project');
  url.hash = KEY + '=' + toBase64Url(packed);
  return url.toString();
}

/** Whether a link's `#` carries a shared design. */
export const hasDesign = (hash: string) => new URLSearchParams(hash.replace(/^#/, '')).has(KEY);

/** The design in a share link; throws when the link is damaged or cut short (some apps shorten long links). */
export async function designFromLink(hash: string): Promise<ProjectDocument> {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get(KEY);
  if (!code) throw new Error('This link carries no design.');
  const text = new TextDecoder().decode(await through(fromBase64Url(code.trim()), new DecompressionStream('deflate-raw')));
  return deserializeProject(text);
}
