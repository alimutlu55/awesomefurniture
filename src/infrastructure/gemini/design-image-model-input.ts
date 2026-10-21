import { ImageGenerationError } from './image-generation-error.ts';

/**
 * Gemini Nano Banana 2.1 accepts 131,072 input tokens. Numeric JSON can tokenize at roughly two
 * characters per token, so this keeps the specification text well clear of the limit after the
 * system prompt and three reference images are added.
 */
export const MAX_MODEL_SPECIFICATION_CHARS = 200_000;

export { modelSpecification } from '../../application/projects/design-image-model-specification.ts';
import { modelSpecification } from '../../application/projects/design-image-model-specification.ts';

export function modelSpecificationText(specification: unknown): string {
  const text = JSON.stringify(modelSpecification(specification));
  if (text.length > MAX_MODEL_SPECIFICATION_CHARS) {
    throw new ImageGenerationError(413, 'TOO_LARGE', 'This design is too large to create an image.');
  }
  return text;
}
