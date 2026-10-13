import type { InputField } from '@/types';
import { selectedSpec } from './rowState';

/**
 * "Newer AI candidate available": a person has already decided on this row
 * (accepted, edited or rejected it), and a later extraction run produced a
 * candidate the row does not use. The backend leaves such a row alone on
 * re-extraction (B15/R1), so without this hint the newer candidate would sit
 * unnoticed.
 *
 * Read only from what the project payload already carries: each candidate's
 * `run_number`, and `selected_candidate_id` (the payload returns the latest
 * run's candidates plus the currently selected one). When either run number is
 * unknown, say nothing -- a value a person typed with no candidate has no run
 * to compare.
 */
export function newerCandidateAvailable(field: InputField): boolean {
  const touched = field.reviewAction !== 'PENDING' || field.isHumanModified === true;
  if (!touched) return false;
  const selected = selectedSpec(field);
  if (!selected?.candidateId || typeof selected.runNumber !== 'number') return false;
  const selectedRun = selected.runNumber;
  return field.specifications.some(
    (s) => s.candidateId !== null && s.id !== selected.id && typeof s.runNumber === 'number' && s.runNumber > selectedRun,
  );
}
