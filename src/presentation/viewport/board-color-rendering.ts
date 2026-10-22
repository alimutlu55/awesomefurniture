import type { MeshStandardMaterial } from 'three';

/** Catalog boards are color references: retain PBR shadows and texture detail without the room's
 * photographic exposure, warm white balance or filmic shoulder replacing the selected swatch tone. */
export function applyBoardColorRendering(material: MeshStandardMaterial) {
  material.toneMapped = false;
  material.envMapIntensity = .15;
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
      vec3 boardDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
      vec3 boardIllumination = boardDiffuse / max(diffuseColor.rgb, vec3(0.0001));
      float boardShade = clamp(dot(boardIllumination, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
      vec3 boardSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
      outgoingLight = diffuseColor.rgb * boardShade + min(boardSpecular, diffuseColor.rgb * 0.025);
      gl_FragColor = vec4(outgoingLight, diffuseColor.a);
    `);
  };
  material.customProgramCacheKey = () => 'catalog-board-color-v1';
}
