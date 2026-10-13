import type { SpecificationSource } from '@/types';

/**
 * A highlight for one document. `nonce` changes on every jump, so the viewer
 * scrolls to it once per jump and not again when the user returns to the
 * document later (the highlight itself stays drawn).
 */
export interface ViewerHighlight {
  source: SpecificationSource;
  nonce: number;
  /** The candidate's value. The Excel viewer marks matching cells inside the source table. */
  value?: string | null;
  /**
   * Which of the matching cells is current (Excel only; 0 when absent). The
   * source bar's "N of M" buttons change it without a new jump nonce.
   */
  matchIndex?: number;
}
