import type { SpecificationSource } from '@/types';

/**
 * A highlight for one document. `nonce` changes on every jump, so the viewer
 * scrolls to it once per jump and not again when the user returns to the
 * document later (the highlight itself stays drawn).
 */
export interface ViewerHighlight {
  source: SpecificationSource;
  nonce: number;
}
