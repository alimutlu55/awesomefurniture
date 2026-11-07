import type { EngineService } from '../../application/engine/engine-service';
import type { FixAction } from '../../domain/engine/rules/engine-rules';
import type { CreditCurrency } from '../../domain/credits/credit-catalog';
import type { EditorScene } from '../../application/projects/editor-scene';

/** What the Insight panel needs from the editor: its DOM scope and lifetime, the scene, the engine and the fixes. */
export interface InsightPanelPorts {
  readonly dom: Readonly<Pick<ReturnType<typeof import('../editor/editor-dom.js').createEditorDom>, '$' | 'host'>>;
  readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen' | 'cleanup' | 'timeout' | 'cancelTimeout'>>;
  readonly scene: () => EditorScene;
  readonly engine: EngineService;
  /** Applies a finding's fix with the editor's commands; false when it no longer applies. */
  readonly fix: (action: FixAction) => boolean;
  readonly closeMenu: () => void;
  readonly toast: (message: string) => void;
  /** The currency prices start in, before the person picks one. */
  readonly currency: CreditCurrency;
  readonly setCurrency: (currency: CreditCurrency) => void;
}
