import type * as THREE from 'three';

/** One clock for every shimmering surface, in seconds; the frame loop moves it (frozen with reduced motion). */
const clock = { value: 0 };
export function tickLoadingShimmer(nowMs: number) { clock.value = nowMs / 1000; }

type Shader = Parameters<THREE.Material['onBeforeCompile']>[0];
const VERTEX = ['varying vec3 vShimmerWorld;\n', '#include <project_vertex>', '#include <project_vertex>\n  vShimmerWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'] as const;
// The app's loading surface in 3D: the surface settles to the placeholder tone, and a soft light sweeps across
// it every 2.2 s, as `.ui-loading-surface` does in the page. Only while `shimmerLoading` is 1.
const FRAGMENT = ['uniform float shimmerLoading;\nuniform float shimmerTime;\nvarying vec3 vShimmerWorld;\n', '#include <tonemapping_fragment>',
  `if (shimmerLoading > 0.5) {
    float sweep = fract(shimmerTime / 2.2) * 1.6 - 0.3;
    float along = fract((vShimmerWorld.x + vShimmerWorld.y * 0.55) / 260.0);
    float gleam = smoothstep(0.18, 0.0, abs(along - sweep)) * 0.55;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.914, 0.898, 0.867), 0.45) + gleam;
  }
  #include <tonemapping_fragment>`] as const;

/** Adds the shader text of the loading surface; pure, so the shader can be checked without a GPU. */
export function shimmerShader(shader: Pick<Shader, 'vertexShader' | 'fragmentShader'>) {
  shader.vertexShader = VERTEX[0] + shader.vertexShader.replace(VERTEX[1], VERTEX[2]);
  shader.fragmentShader = FRAGMENT[0] + shader.fragmentShader.replace(FRAGMENT[1], FRAGMENT[2]);
}

/**
 * Puts one surface into the loading state while what it shows is still arriving (a decor scan downloading):
 * placeholder tone and a sweep of light, on that surface only, inside its own shader, so nothing else is
 * redrawn or slowed. The material's own shader changes are kept. `done` ends it, without recompiling.
 */
export function startLoadingShimmer(material: THREE.Material) {
  const loading = { value: 1 }, own = material.onBeforeCompile, ownKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    own.call(material, shader, renderer);
    shader.uniforms.shimmerLoading = loading;
    shader.uniforms.shimmerTime = clock;
    shimmerShader(shader);
  };
  material.customProgramCacheKey = () => ownKey.call(material) + '|loading-shimmer';
  material.userData.loadingShimmer = loading;
  material.needsUpdate = true;
  return { done() { loading.value = 0; }, get active() { return loading.value > 0; } };
}
