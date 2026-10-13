import { describe, expect, it } from 'vitest';
import { runningJobText } from './label';
import type { Job } from './types';

const correction = (phase: Job['phase']) =>
  ({ kind: 'correction', phase, payload: { kind: 'correction', parameterKey: 'U_MIN' } }) as unknown as Job;
const extraction = (phase: Job['phase']) =>
  ({ kind: 'extraction', phase, payload: { kind: 'extraction' } }) as unknown as Job;

describe('runningJobText', () => {
  it('says Re-extracting before a correction has any event, never "Routing sections"', () => {
    expect(runningJobText(correction('routing'))).toBe('Re-extracting U_MIN…');
  });
  it('shows the phase once a correction has progressed', () => {
    expect(runningJobText(correction('extracting'))).toBe('Re-extracting U_MIN: Extracting');
  });
  it('keeps "Routing sections" for a blind extraction', () => {
    expect(runningJobText(extraction('routing'))).toBe('Extraction: Routing sections');
  });
});
