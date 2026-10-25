import type { DesignReferenceImage, RenderPromptConfig, RenderStyle } from '../../application/projects/design-image.ts';
import { GEMINI_DESIGN_IMAGE_REFERENCE_LABELS, REALISTIC_COMPLETION, REALISTIC_REQUEST, buildSystemInstruction } from './design-image-prompt.ts';
import { STUDIO_COMPLETION, STUDIO_REFERENCE_LABELS, STUDIO_REQUEST, buildStudioSystemInstruction } from './studio-image-prompt.ts';
import { CONCEPT_COMPLETION, CONCEPT_REFERENCE_LABELS, CONCEPT_REQUEST, buildConceptSystemInstruction } from './concept-image-prompt.ts';

/** Everything Gemini reads that depends on the chosen look. The Tier 1 manifest and board swatches are shared. */
export interface StylePrompt {
  referenceLabels: Record<DesignReferenceImage['view'], string>;
  systemInstruction(config: RenderPromptConfig): string;
  /** Opens the final text block, before the Tier 1 manifest. */
  request: string;
  /** Closes the final text block, after the Tier 1 manifest. */
  completion: string;
}

export const STYLE_PROMPTS: Record<RenderStyle, StylePrompt> = {
  realistic: { referenceLabels: GEMINI_DESIGN_IMAGE_REFERENCE_LABELS, systemInstruction: buildSystemInstruction,
    request: REALISTIC_REQUEST, completion: REALISTIC_COMPLETION },
  studio: { referenceLabels: STUDIO_REFERENCE_LABELS, systemInstruction: buildStudioSystemInstruction,
    request: STUDIO_REQUEST, completion: STUDIO_COMPLETION },
  concept: { referenceLabels: CONCEPT_REFERENCE_LABELS, systemInstruction: buildConceptSystemInstruction,
    request: CONCEPT_REQUEST, completion: CONCEPT_COMPLETION },
};

export const stylePrompt = (config: RenderPromptConfig): StylePrompt => STYLE_PROMPTS[config.style ?? 'realistic'];
