import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shimmerShader, startLoadingShimmer } from '../../src/presentation/viewport/loading-shimmer';
import { createSceneLooks } from '../../src/presentation/viewport/scene-looks';

test('a surface still loading shimmers in its own shader, keeps its own shader changes, and stops without recompiling', () => {
  const material = new THREE.MeshStandardMaterial(), calls: string[] = [];
  material.onBeforeCompile = () => { calls.push('own'); };
  material.customProgramCacheKey = () => 'board';
  const loading = startLoadingShimmer(material), version = material.version;
  const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader as never, {} as never);
  assert.deepEqual(calls, ['own'], 'the surface’s own shader change still runs');
  assert.match(shader.vertexShader, /vShimmerWorld = \(modelMatrix/);
  assert.match(shader.fragmentShader, /shimmerLoading > 0\.5/);
  assert.equal(shader.uniforms.shimmerLoading!.value, 1);
  assert.match(material.customProgramCacheKey(), /^board\|loading-shimmer$/);
  loading.done();
  assert.equal(shader.uniforms.shimmerLoading!.value, 0);
  assert.equal(material.version, version, 'ending it changes a uniform, not the program');
  const plain = { vertexShader: 'x', fragmentShader: 'y' };
  shimmerShader(plain);
  assert.ok(plain.vertexShader.startsWith('varying vec3 vShimmerWorld;'));
});

test('a texture arriving after a time of day was chosen stays on through later changes of light and captures', () => {
  const scene = new THREE.Scene(), board = new THREE.MeshStandardMaterial({ color: 0x8a6a40 });
  board.userData.board = true;
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2), board));
  const looks = createSceneLooks({ scene });
  looks.set({ look: 'living', env: .62, emissive: .8 });        // Sunset: the surface is directed before its scan arrives.
  const scan = new THREE.Texture();
  board.map = scan; board.color.set('#ffffff'); board.needsUpdate = true;   // The decor scan arrives.
  looks.set({ env: .1, emissive: .06 });                         // Night.
  assert.equal(board.map, scan, 'the scan survives a change of light');
  assert.equal(board.color.getHex(), 0xffffff);
  looks.suspend(); looks.resume();                               // A design thumbnail or AI image capture.
  assert.equal(board.map, scan, 'and a capture');
  looks.set({ look: 'maquette' });
  assert.equal(board.map, null, 'the card model draws without it');
  looks.set({ look: 'living', env: 1, emissive: 1 });
  assert.equal(board.map, scan, 'and it comes back');
  looks.dispose();
});
