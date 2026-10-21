import type { ImageDesignSpecification } from './image-design-specification.ts';

export const IMAGE_VIEWS = ['front', 'left', 'right'] as const;
export interface DesignReferenceImage {
  view: typeof IMAGE_VIEWS[number];
  mimeType: 'image/jpeg';
  data: string;
  width: number;
  height: number;
  camera: { position: number[]; target: number[]; fov: number };
}
export interface DesignImageRequest {
  specification: ImageDesignSpecification;
  references: DesignReferenceImage[];
}
export interface GeneratedDesignImage { mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
export interface DesignImageResponse { model: string; image: GeneratedDesignImage }
