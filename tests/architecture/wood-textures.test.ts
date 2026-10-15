import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oakMaps, preloadOakTextures } from '../../src/presentation/viewport/wood-textures';

function fixture() {
  const requested: ImageStub[] = [];
  class ImageStub {
    src = '';
    decoding = '';
    onload = () => {};
    onerror = () => {};
    constructor() { requested.push(this); }
  }
  const document = {
    defaultView: { Image: ImageStub },
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {} }) }),
  } as unknown as Document;
  return { document, requested };
}

test('preloading overlaps session startup and all editor mounts reuse the six optimized images', async () => {
  const { document, requested } = fixture();
  preloadOakTextures(document);
  assert.equal(requested.length, 6);
  const first = oakMaps(document, 'planks'), second = oakMaps(document, 'planks');
  const veneer = oakMaps(document, 'veneer');
  assert.equal(requested.length, 6, 'mounting does not redownload preloaded maps');
  for (const image of requested) {
    assert.match(image.src, /\.webp$/);
    assert.equal(image.decoding, 'async');
    image.onload();
  }
  await Promise.resolve();
  assert.equal(first.map.image, second.map.image, 'decoded data is shared');
  assert.notEqual(first.map, second.map, 'each material keeps independent UVs and disposal');
  first.map.repeat.set(2, 3);
  assert.deepEqual(second.map.repeat.toArray(), [1, 1]);
  for (const maps of [first, second, veneer]) Object.values(maps).forEach(texture => texture.dispose());
});

test('late image completions cannot revive disposed textures or affect another document', async () => {
  const a = fixture(), b = fixture();
  const first = oakMaps(a.document, 'planks'), second = oakMaps(b.document, 'planks');
  const placeholder = first.map.image, version = first.map.version;
  first.map.dispose();
  a.requested.forEach(image => image.onload());
  b.requested.forEach(image => image.onload());
  await Promise.resolve();
  assert.equal(first.map.image, placeholder);
  assert.equal(first.map.version, version);
  assert.equal(second.map.image, b.requested[0]);
  for (const maps of [first, second]) Object.values(maps).forEach(texture => texture.dispose());
});

test('unavailable images keep neutral material fallbacks without rejecting startup', async () => {
  const { document, requested } = fixture();
  const maps = oakMaps(document, 'veneer');
  const placeholders = Object.values(maps).map(texture => texture.image);
  requested.forEach(image => image.onerror());
  await Promise.resolve();
  assert.deepEqual(Object.values(maps).map(texture => texture.image), placeholders);
  Object.values(maps).forEach(texture => texture.dispose());
});

test('images that finish during session restoration are present in the very first rendered frame', async () => {
  const { document, requested } = fixture();
  preloadOakTextures(document);
  requested.forEach(image => image.onload());
  await Promise.resolve();
  const maps = oakMaps(document, 'planks');
  assert.ok(requested.includes(maps.map.image), 'first render must not flash a white placeholder');
  assert.ok(requested.includes(maps.normalMap.image));
  assert.ok(requested.includes(maps.roughnessMap.image));
  const version = maps.map.version;
  await Promise.resolve();
  assert.equal(maps.map.version, version, 'already installed textures must not upload twice');
  Object.values(maps).forEach(texture => texture.dispose());
});
