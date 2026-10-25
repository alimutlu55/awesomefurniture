import * as THREE from 'three';

/** Share decoded local manufacturer scans across rebuilds; each material owns its GPU texture. */
export function createDecorTextureLoader(document: Document) {
  const images = new Map<string, Promise<HTMLImageElement | null>>();
  /** `ready` runs when the scan has arrived; `failed` when it cannot be shown (missing or unreadable). */
  return (url: string, ready: (texture: THREE.Texture) => void, failed?: () => void): THREE.Texture => {
    let source = images.get(url);
    if (!source) {
      source = new Promise(resolve => {
        const image = new document.defaultView!.Image();
        image.decoding = 'async';
        image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = url;
      });
      images.set(url, source);
    }
    const texture = new THREE.Texture();
    texture.encoding = THREE.sRGBEncoding;
    // Manufacturer sample crops are not seamless tiles. Mirror the boundary so
    // larger panels retain continuous grain instead of rectangular cut lines.
    texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
    let disposed = false;
    texture.addEventListener('dispose', () => { disposed = true; });
    void source.then(image => {
      if (disposed) return;
      if (!image) { failed?.(); return; }
      texture.image = image; texture.needsUpdate = true; ready(texture);
    });
    return texture;
  };
}
