import type { ImageDesignSpecification } from './image-design-specification.ts';

// Canonical 1K reference renders, independent of the editor viewport size.
export const DESIGN_REFERENCE_WIDTH = 1024;
export const DESIGN_REFERENCE_HEIGHT = 768;
export const DESIGN_REFERENCE_JPEG_QUALITY = .97;

export const IMAGE_VIEWS = ['front', 'left', 'right'] as const;
export interface RenderPromptConfig {
  category: 'wardrobe' | 'kitchen';
  stagingLevel: 1 | 2 | 3;
  hasIntegratedLed?: boolean | undefined;
  hasCeilingBulkhead?: boolean | undefined;
}
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
  renderConfig?: RenderPromptConfig;
  decorSwatches?: DecorSwatchReference[];
}
export interface DecorSwatchReference { decorId: string; mimeType: 'image/webp' | 'image/jpeg' | 'image/png'; data: string }
export interface GeneratedDesignImage { mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
/** `credits`: the balance after this image was paid for, and what it cost (docs/credits.md). */
export interface DesignImageResponse { model: string; image: GeneratedDesignImage; text?: string; credits?: { balance: number; cost: number } }
